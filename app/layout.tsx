export const metadata = { title: "Ultriva Chat", description: "Webhook-enabled chat" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell' }}>
        {children}
      </body>
    </html>
  );
}
