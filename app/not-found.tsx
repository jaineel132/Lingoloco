import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F4EBD9]">
      <div className="text-center max-w-md p-8">
        <h1 className="text-6xl font-bold text-[#C4A46C] font-serif mb-4">404</h1>
        <p className="text-[#5C4033] text-xl font-serif mb-6">Page not found</p>
        <Link
          href="/"
          className="px-6 py-2 bg-[#C4A46C] text-white rounded-lg hover:bg-[#B08F4F] transition-colors font-serif inline-block"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
