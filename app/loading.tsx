export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F4EBD9]">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#C4A46C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#5C4033] text-lg font-serif">Loading...</p>
      </div>
    </div>
  );
}
