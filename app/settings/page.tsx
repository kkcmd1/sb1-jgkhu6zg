import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Link className="underline text-[#1C6F66]" href="/auth">Sign-in page</Link>
    </div>
  );
}
