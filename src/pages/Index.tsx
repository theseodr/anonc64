import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Github } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative isolate mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Ambient glow and grid */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-hero-grid opacity-80" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_hsl(var(--primary))/0.16,_transparent_55%)]" />

        <header className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/60 shadow-soft">
              <span className="text-xs font-mono tracking-[0.22em] text-primary">C64</span>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Retro Static Studio
              </p>
              <p className="text-xs text-muted-foreground/80">React · Vite · Tailwind</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#workflow" className="transition-colors hover:text-foreground">
              Workflow
            </a>
            <a href="#deploy" className="transition-colors hover:text-foreground">
              Deploy
            </a>
            <Button asChild variant="outline" size="sm">
              <a href="https://github.com" target="_blank" rel="noreferrer">
                <Github className="mr-2" />
                View Repo
              </a>
            </Button>
          </nav>
        </header>

        <main className="mb-12 grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section aria-labelledby="hero-heading">
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-border/60 bg-secondary/40 px-4 py-1 text-xs font-mono uppercase tracking-[0.26em] text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-primary" />
              <span>Optimised for static web servers</span>
            </div>
            <h1
              id="hero-heading"
              className="mb-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              C64-inspired static site, rebuilt for modern stacks.
            </h1>
            <p className="mb-8 max-w-xl text-base text-muted-foreground sm:text-lg">
              A single-page React experience with a retro soul—bundled by Vite, styled with Tailwind, and ready to drop
              into any static host from Nginx to Netlify.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" variant="hero" className="group">
                <span>Build &amp; preview</span>
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="ghost" className="border border-dashed border-border/70">
                Static-first architecture
              </Button>
            </div>
            <dl className="mt-8 grid gap-6 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Stack</dt>
                <dd className="mt-1">React · Vite · Tailwind</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Hosting</dt>
                <dd className="mt-1">Any static web server</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Bundle</dt>
                <dd className="mt-1">Single-page app</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Preview of the static site" className="lg:justify-self-end">
            <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:shadow-glow">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_0_0,_hsl(var(--accent))/0.45,_transparent_55%)]" />
              <CardHeader className="relative pb-4">
                <CardTitle className="flex items-center justify-between text-base font-mono uppercase tracking-[0.28em]">
                  <span>STATIC PREVIEW</span>
                  <span className="rounded-md bg-secondary/60 px-2 py-1 text-[0.65rem] font-normal text-secondary-foreground">
                    LIVE
                  </span>
                </CardTitle>
                <CardDescription className="mt-3 text-xs">
                  Simulated above-the-fold view of your retro-flavoured landing page.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="overflow-hidden rounded-[1.1rem] border border-border/70 bg-background/80 p-5">
                  <div className="mb-3 flex items-center gap-2 text-[0.65rem] font-mono uppercase tracking-[0.26em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Anon C64 Site</span>
                  </div>
                  <p className="mb-2 text-sm font-semibold">
                    Retro console aesthetic without sacrificing modern tooling.
                  </p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    This project mirrors your static export in a React-first stack, so you can deploy it anywhere you
                    serve HTML, CSS, and JS.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[0.65rem] font-mono uppercase tracking-[0.26em]">
                    <span className="rounded-full bg-secondary/60 px-3 py-1 text-secondary-foreground">
                      SINGLE INDEX.HTML
                    </span>
                    <span className="rounded-full bg-secondary/40 px-3 py-1 text-secondary-foreground/90">
                      ZERO SERVER STATE
                    </span>
                    <span className="rounded-full bg-secondary/30 px-3 py-1 text-secondary-foreground/90">
                      BLAZING BUILD
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>

        <section id="features" aria-label="Key features" className="mb-10">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Retro aesthetic</CardTitle>
                <CardDescription>
                  C64-inspired typography, glow and grid with a modern layout system.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Static by design</CardTitle>
                <CardDescription>
                  Vite builds a self-contained bundle that you can host on any static provider.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Upgrade ready</CardTitle>
                <CardDescription>
                  Extend with routing, auth, or APIs later—today it&apos;s just lean, static HTML, CSS, and JS.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section
          id="deploy"
          aria-label="Deployment notes"
          className="mt-auto border-t border-border/70 pt-6 text-xs text-muted-foreground"
        >
          <p>
            To deploy on a static web server: run
            <code className="mx-1 rounded border border-border/60 bg-card px-1.5 py-0.5 text-[0.7rem]">npm run build</code>
            and serve the
            <code className="mx-1 rounded border border-border/60 bg-card px-1.5 py-0.5 text-[0.7rem]">dist</code>
            directory with your favourite HTTP server.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Index;
