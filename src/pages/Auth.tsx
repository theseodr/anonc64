import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const authSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type AuthFormValues = z.infer<typeof authSchema>;

const Auth = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: AuthFormValues) => {
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) {
          toast.error(error.message || "Unable to sign in.");
        } else {
          toast.success("Signed in successfully.");
        }
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) {
          toast.error(error.message || "Unable to sign up.");
        } else {
          toast.success("Account created. Check your email if confirmation is required.");
          setMode("login");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "login" ? "Sign in" : "Create account";
  const description =
    mode === "login" ? "Enter your credentials to access the collaborative C64 board." : "Create an account to join the shared C64 whiteboard and chat.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <Card className="border-border/70 bg-card/90 shadow-soft">
          <CardHeader>
            <CardTitle asChild>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait..." : title}
              </Button>
            </form>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>{mode === "login" ? "Need an account?" : "Already registered?"}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 text-xs"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
