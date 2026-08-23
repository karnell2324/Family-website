import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Website",
  description: "A private family space for news, history, photographs, learning, and events.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
