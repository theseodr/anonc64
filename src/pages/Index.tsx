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

const DEFAULT_BOARD_TITLE = "Global C64 Board";

const Index = () => {
  const [board, setBoard] = useState<Board | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [initialising, setInitialising] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

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
      backgroundColor: "#000000",
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
        fabricCanvas.set("backgroundColor", "#000000");
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

  const handleClearBoard = async () => {
    if (!board || !fabricCanvas) return;

    fabricCanvas.clear();
    fabricCanvas.set("backgroundColor", "#000000");
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
                  Draw in real time with others. The canvas state is synced through the Lovable backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={canvasContainerRef}
                  className="relative h-[420px] rounded-md border border-border bg-background/80 sm:h-[520px] lg:h-[560px]"
                >
                  <canvas ref={canvasRef} className="h-full w-full" aria-label="Collaborative whiteboard" />
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
                  <span className="font-mono uppercase tracking-[0.18em] text-foreground">Title:</span> {" "}
                  {board?.title ?? "Untitled"}
                </p>
                <p>
                  <span className="font-mono uppercase tracking-[0.18em] text-foreground">Visibility:</span> Public
                </p>
                <p>
                  State persists in Lovable Cloud with realtime updates for strokes and chat.
                </p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default Index;
