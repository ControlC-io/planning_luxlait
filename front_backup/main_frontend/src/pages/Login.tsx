import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = isSignUp ?
    await signUp(email, password) :
    await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (isSignUp) {
      toast({ title: "Compte créé", description: "Vérifiez votre email pour confirmer." });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Luxlait Planning</CardTitle>
          <CardDescription>
            {isSignUp ? "Créer un compte" : "Connectez-vous pour accéder au planning"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required />
            
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6} />
            
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "..." : isSignUp ? "Créer le compte" : "Se connecter"}
            </Button>
          </form>
          




          
        </CardContent>
      </Card>
    </div>);

}