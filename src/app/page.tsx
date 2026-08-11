export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/60 sm:p-12">
        <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
          Milestone 0
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">CS 野榜</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
          Repository and runtime foundation initialized. The public voting experience begins in a
          later milestone.
        </p>
      </section>
    </main>
  );
}
