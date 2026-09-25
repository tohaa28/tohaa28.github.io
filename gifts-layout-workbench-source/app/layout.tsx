import "./globals.css";

export const metadata = {
  title: "Макетная gifts.ru",
  description: "Редактор макетов для заказов gifts.ru"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
