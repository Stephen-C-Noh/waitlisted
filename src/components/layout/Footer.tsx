export function Footer() {
  return (
    <footer className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-on-surface/10">
      <div className="text-lg font-headline text-primary uppercase tracking-widest">
        Waitlisted
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        <span className="font-label text-[12px] tracking-[0.2em] uppercase text-on-surface-variant/40">
          Contact
        </span>
        <span className="font-label text-[12px] tracking-[0.2em] uppercase text-on-surface-variant/40">
          Location
        </span>
        <span className="font-label text-[12px] tracking-[0.2em] uppercase text-on-surface-variant/40">
          Privacy
        </span>
      </div>
      <p className="font-label text-[12px] tracking-[0.2em] uppercase text-on-surface-variant/40">
        &copy; 2026 Waitlisted. All rights reserved.
      </p>
    </footer>
  );
}
