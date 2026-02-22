export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="hero-card rounded-3xl p-6 md:p-7">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton mt-3 h-10 w-72 rounded-xl" />
        <div className="skeleton mt-3 h-4 w-full max-w-2xl rounded" />
        <div className="skeleton mt-2 h-4 w-80 rounded" />
      </div>

      <div className="soft-card rounded-3xl p-5">
        <div className="skeleton h-7 w-56 rounded-lg" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="soft-card rounded-3xl p-5">
          <div className="skeleton h-7 w-48 rounded-lg" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="soft-card rounded-3xl p-5">
          <div className="skeleton h-7 w-36 rounded-lg" />
          <div className="mt-4 space-y-3">
            <div className="skeleton h-18 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
