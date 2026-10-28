import { ProfileTabs } from "./ProfileTabs";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ProfileTabs />
      {children}
    </div>
  );
}
