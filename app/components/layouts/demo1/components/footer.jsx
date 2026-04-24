'use client';

import { Container } from '@/components/common/container';

export function Footer() {
  return (
    <footer className="footer">
      <Container>
        <div className="flex justify-center items-center py-5">
          <span className="text-muted-foreground font-normal text-sm">
            Kingsgate Dashboard &copy; 2026 Glorist Smart Solutions
          </span>
        </div>
      </Container>
    </footer>
  );
}
