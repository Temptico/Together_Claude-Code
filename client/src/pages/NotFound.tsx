import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="text-5xl">💔</div>
      <p className="font-extrabold">Stran ne obstaja</p>
      <Button asChild>
        <Link href="/">Nazaj domov</Link>
      </Button>
    </div>
  );
}
