'use client';

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F4EBD9]">
      <div className="text-center max-w-md p-8">
        <h1 className="text-3xl font-bold text-[#5C4033] font-serif mb-4">Something went wrong</h1>
        <p className="text-[#8B7355] mb-6 font-serif">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-[#C4A46C] text-white rounded-lg hover:bg-[#B08F4F] transition-colors font-serif"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
