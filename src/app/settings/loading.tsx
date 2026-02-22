export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      <div className="hero-card rounded-3xl p-6 md:p-7">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton mt-3 h-9 w-52 rounded-xl" />
        <div className="skeleton mt-3 h-4 w-full max-w-xl rounded" />
      </div>

      <div className="soft-card rounded-3xl p-5">
        <div className="skeleton h-7 w-56 rounded-lg" />
        <div className="mt-4 space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
