import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Board {
  id: string;
  title: string;
  description: string | null;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: string | null;
}

interface VideoTile {
  id: string;
  board_id: string;
  source_type: "youtube" | "upload";
  youtube_video_id: string | null;
  file_path: string | null;
  start_at_seconds: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

const extractYouTubeId = (input: string): string | null => {
  const trimmed = input.trim();

  // Bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    const vParam = url.searchParams.get("v");
    if (vParam) {
      return vParam;
    }

    if (url.hostname.includes("youtube.com")) {
      const segments = url.pathname.split("/");
      const shortsIndex = segments.indexOf("shorts");
      if (shortsIndex !== -1 && segments[shortsIndex + 1]) {
        return segments[shortsIndex + 1];
      }
    }
  } catch {
    // Not a valid URL, fall through
  }

  return null;
};

const DEFAULT_BOARD_TITLE = "Global C64 Board";

const Index = () => {
  const [board, setBoard] = useState<Board | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [initialising, setInitialising] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);

  useEffect(() => {
    const ensureDefaultBoard = async () => {
      try {
        const { data, error } = await supabase
          .from("boards")
          .select("id, title, description")
          .eq("title", DEFAULT_BOARD_TITLE)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast.error("Unable to load board.");
          setInitialising(false);
          return;
        }

        if (data) {
          setBoard(data as Board);
          setInitialising(false);
          return;
        }

        // Board should already exist from a backend migration; if not, create a
        // public global board with no specific owner.
        const { data: created, error: insertError } = await supabase
          .from("boards")
          .insert({
            title: DEFAULT_BOARD_TITLE,
            visibility: "public",
            owner_id: null,
          })
          .select("id, title, description")
          .single();

        if (insertError) {
          console.error(insertError);
          toast.error("Unable to create board.");
        } else {
          setBoard(created as Board);
        }
      } finally {
        setInitialising(false);
      }
    };

    ensureDefaultBoard();
  }, []);

  // Fabric canvas setup
  useEffect(() => {
    if (!board || !canvasRef.current || !canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "transparent",
    });

    canvas.isDrawingMode = true;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = "#00d7d7";
      canvas.freeDrawingBrush.width = 2;
    }

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, [board]);

  // Load latest board state into Fabric
  useEffect(() => {
    if (!board || !fabricCanvas) return;

    const loadLatestSnapshot = async () => {
      const { data, error } = await supabase
        .from("strokes")
        .select("path_data")
        .eq("board_id", board.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      if (data?.path_data) {
        try {
          fabricCanvas.loadFromJSON(data.path_data as any, () => {
            fabricCanvas.renderAll();
          });
        } catch (err) {
          console.error("Failed to load canvas state", err);
        }
      } else {
        fabricCanvas.clear();
        fabricCanvas.set("backgroundColor", "transparent");
        fabricCanvas.renderAll();
      }
    };

    loadLatestSnapshot();
  }, [board, fabricCanvas]);

  // Persist strokes on draw
  useEffect(() => {
    if (!board || !fabricCanvas) return;

    const handlePathCreated = async () => {
      try {
        const json = fabricCanvas.toJSON();
        const { error } = await supabase.from("strokes").insert({
          board_id: board.id,
          user_id: null,
          path_data: json,
          color: "#00d7d7",
          width: 2,
        });
        if (error) {
          console.error(error);
          toast.error("Failed to save stroke.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error while saving stroke.");
      }
    };

    const listener = () => void handlePathCreated();

    fabricCanvas.on("path:created", listener as any);

    return () => {
      fabricCanvas.off("path:created", listener as any);
    };
  }, [board, fabricCanvas]);

  // Realtime updates for strokes
  useEffect(() => {
    if (!board || !fabricCanvas) return;

    const channel = supabase
      .channel(`strokes-board-${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "strokes",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          const next = (payload.new as any)?.path_data;
          if (!next) return;
          try {
            fabricCanvas.loadFromJSON(next, () => {
              fabricCanvas.renderAll();
            });
          } catch (err) {
            console.error("Failed to apply remote stroke", err);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board, fabricCanvas]);

  // Video tiles: load initial tiles
  useEffect(() => {
    if (!board) return;

    const loadTiles = async () => {
      const { data, error } = await supabase
        .from("video_tiles")
        .select(
          "id, board_id, source_type, youtube_video_id, file_path, start_at_seconds, x, y, width, height",
        )
        .eq("board_id", board.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Unable to load video tiles.");
        return;
      }

      setVideoTiles((data ?? []) as VideoTile[]);
    };

    loadTiles();
  }, [board]);

  // Video tiles: realtime changes
  useEffect(() => {
    if (!board) return;

    const channel = supabase
      .channel(`video-tiles-board-${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_tiles",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setVideoTiles((prev) => {
            const next = payload.new as VideoTile;
            if (prev.some((tile) => tile.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_tiles",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          const updated = payload.new as VideoTile;
          setVideoTiles((prev) => prev.map((tile) => (tile.id === updated.id ? updated : tile)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "video_tiles",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          const removed = payload.old as VideoTile;
          setVideoTiles((prev) => prev.filter((tile) => tile.id !== removed.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board]);

  // Chat: load initial messages
  useEffect(() => {
    if (!board) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, created_at, user_id")
        .eq("board_id", board.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Unable to load chat.");
      } else {
        setMessages(data as Message[]);
      }
    };

    loadMessages();
  }, [board]);

  // Chat: realtime inserts
  useEffect(() => {
    if (!board) return;

    const channel = supabase
      .channel(`messages-board-${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!board || !newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      board_id: board.id,
      user_id: null,
      content,
    });

    if (error) {
      console.error(error);
      toast.error("Failed to send message.");
    }
  };

  const handleAddYouTubeTile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!board || !youtubeLink.trim()) return;

    const videoId = extractYouTubeId(youtubeLink);
    if (!videoId) {
      toast.error("Please enter a valid YouTube URL or video ID.");
      return;
    }

    setYoutubeLink("");

    const { data, error } = await supabase
      .from("video_tiles")
      .insert({
        board_id: board.id,
        user_id: null,
        source_type: "youtube",
        youtube_video_id: videoId,
        start_at_seconds: 0,
      })
      .select("id, board_id, source_type, youtube_video_id, file_path, start_at_seconds, x, y, width, height")
      .single();

    if (error) {
      console.error(error);
      toast.error("Failed to add video tile.");
    } else if (data) {
      setVideoTiles((prev) => [...prev, data as VideoTile]);
    }
  };

  const handleUploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!board) return;

    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file is too large (max 50MB).");
      return;
    }

    try {
      setIsUploading(true);
      const filePath = `${board.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("videos").upload(filePath, file);

      if (uploadError || !uploadData) {
        console.error(uploadError);
        toast.error("Failed to upload video.");
        return;
      }

      const { data: tile, error: tileError } = await supabase
        .from("video_tiles")
        .insert({
          board_id: board.id,
          user_id: null,
          source_type: "upload",
          file_path: uploadData.path,
          start_at_seconds: 0,
        })
        .select("id, board_id, source_type, youtube_video_id, file_path, start_at_seconds, x, y, width, height")
        .single();

      if (tileError) {
        console.error(tileError);
        toast.error("Failed to create video tile.");
      } else if (tile) {
        setVideoTiles((prev) => [...prev, tile as VideoTile]);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleTilePointerDown = (tileId: string, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingTileId(tileId);
    dragPointerRef.current = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleTilePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTileId || !dragPointerRef.current) return;

    const { x, y } = dragPointerRef.current;
    const deltaX = event.clientX - x;
    const deltaY = event.clientY - y;
    dragPointerRef.current = { x: event.clientX, y: event.clientY };

    setVideoTiles((prev) =>
      prev.map((tile) => (tile.id === draggingTileId ? { ...tile, x: tile.x + deltaX, y: tile.y + deltaY } : tile)),
    );
  };

  const handleTilePointerUp = async (tileId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPointerRef.current) return;

    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    setDraggingTileId(null);
    dragPointerRef.current = null;

    const tile = videoTiles.find((t) => t.id === tileId);
    if (!tile) return;

    const { error } = await supabase
      .from("video_tiles")
      .update({ x: tile.x, y: tile.y })
      .eq("id", tile.id);

    if (error) {
      console.error(error);
      toast.error("Failed to move video tile.");
    }
  };

  const handleRemoveTile = async (tileId: string) => {
    setVideoTiles((prev) => prev.filter((tile) => tile.id !== tileId));

    const { error } = await supabase.from("video_tiles").delete().eq("id", tileId);
    if (error) {
      console.error(error);
      toast.error("Failed to remove video tile.");
    }
  };

  const handleClearBoard = async () => {
    if (!board || !fabricCanvas) return;

    fabricCanvas.clear();
    fabricCanvas.set("backgroundColor", "transparent");
    fabricCanvas.renderAll();

    const json = fabricCanvas.toJSON();
    const { error } = await supabase.from("strokes").insert({
      board_id: board.id,
      user_id: null,
      path_data: json,
      color: "#00d7d7",
      width: 2,
    });

    if (error) {
      console.error(error);
      toast.error("Failed to clear board state.");
    }
  };

  if (initialising) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading collaborative board…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/60 shadow-soft">
              <span className="text-xs font-mono tracking-[0.22em] text-primary">C64</span>
            </div>
            <div>
              <p className="text-sm font-mono uppercase tracking-[0.22em] text-muted-foreground">Global Board</p>
              <p className="text-xs text-muted-foreground/80">Anonymous collaborative C64 whiteboard &amp; chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Anonymous C64 Board</span>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <Card className="h-full border-border/70 bg-card/90 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold tracking-tight">C64 Whiteboard</CardTitle>
                <CardDescription>
                  Draw in real time with others. The canvas state is synced through the Commodore 64k backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={canvasContainerRef}
                  className="relative h-[420px] rounded-md border border-border bg-background/80 sm:h-[520px] lg:h-[560px]"
                >
                  {/* Shared video tiles layer (under drawing, above background) */}
                  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                    {videoTiles.map((tile) => {
                      const uploadUrl =
                        tile.source_type === "upload" && tile.file_path
                          ? supabase.storage.from("videos").getPublicUrl(tile.file_path).data.publicUrl
                          : null;

                      return (
                        <div
                          key={tile.id}
                          className="absolute border border-border bg-background"
                          style={{
                            left: tile.x,
                            top: tile.y,
                            width: tile.width,
                            height: tile.height,
                          }}
                        >
                          {tile.source_type === "youtube" && tile.youtube_video_id ? (
                            <iframe
                              title="Shared YouTube video tile"
                              src={`https://www.youtube-nocookie.com/embed/${tile.youtube_video_id}?autoplay=0&rel=0`}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{ pointerEvents: "none" }}
                            />
                          ) : null}
                          {tile.source_type === "upload" && uploadUrl ? (
                            <video
                              className="h-full w-full"
                              src={uploadUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              style={{ pointerEvents: "none" }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Drawing canvas above videos */}
                  <canvas
                    ref={canvasRef}
                    className="relative z-10 h-full w-full bg-transparent"
                    aria-label="Collaborative whiteboard"
                  />

                  {/* Drag handles above canvas */}
                  <div className="pointer-events-none absolute inset-0 z-20">
                    {videoTiles.map((tile) => (
                      <div
                        key={tile.id}
                        className="absolute"
                        style={{ left: tile.x, top: Math.max(0, tile.y - 18) }}
                      >
                        <div
                          className="pointer-events-auto flex items-center gap-2 border border-border bg-background px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-[0.18em] text-foreground"
                          onPointerDown={(event) => handleTilePointerDown(tile.id, event)}
                          onPointerMove={handleTilePointerMove}
                          onPointerUp={(event) => handleTilePointerUp(tile.id, event)}
                        >
                          <span>Video</span>
                          <button
                            type="button"
                            className="ml-2 text-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveTile(tile.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Drawing mode: freehand (C64 teal)</span>
                  <Button size="sm" variant="ghost" onClick={handleClearBoard}>
                    Clear board (snapshot)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="w-full space-y-4 lg:w-[340px]">
            <Card className="flex h-[360px] flex-col border-border/70 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono uppercase tracking-[0.22em]">Chat</CardTitle>
                <CardDescription>Coordinate with others while you draw.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pb-3">
                <div className="flex-1 space-y-2 overflow-y-auto rounded border border-border/70 bg-background/60 p-2 text-xs">
                  {messages.length === 0 ? (
                    <p className="text-muted-foreground">No messages yet. Say hi!</p>
                  ) : (
                    messages.map((msg) => {
                      const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <div key={msg.id} className="rounded bg-card/80 px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-primary">
                              Guest
                            </span>
                            <span className="text-[0.65rem] text-muted-foreground">{time}</span>
                          </div>
                          <p className="mt-0.5 text-[0.78rem] leading-snug">{msg.content}</p>
                        </div>
                      );
                    })
                  )}
                </div>
                <form className="flex items-center gap-2" onSubmit={handleSendMessage} aria-label="Send chat message">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message…"
                    className="h-9 text-xs"
                  />
                  <Button type="submit" size="sm" disabled={!newMessage.trim()}>
                    Send
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-[0.22em]">Board status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-mono uppercase tracking-[0.18em] text-foreground">Title:</span>{" "}
                  {board?.title ?? "Untitled"}
                </p>
                <p>
                  <span className="font-mono uppercase tracking-[0.18em] text-foreground">Visibility:</span> Public
                </p>
                <p>State persists in Lovable Cloud with realtime updates for strokes and chat.</p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default Index;
