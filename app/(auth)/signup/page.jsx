import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Registration closed',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          <ShieldOff className="size-10 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Registration is closed</h1>
        <p className="text-sm text-muted-foreground">
          This platform is invite-only. Contact an administrator to get access.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
