import { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50 p-6 md:p-10">{children}</div>;
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl bg-white p-6 shadow-xl">{children}</div>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-bold text-slate-900">{children}</h1>;
}

export function Button({
  children,
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`rounded-2xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700 ${props.className || ''}`}
    />
  );
}