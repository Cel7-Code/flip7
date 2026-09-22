export function AlertModal({
  msg,
  onClose,
}: {
  msg: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center">
      <div className="max-w-[400px] bg-[#141e3c]/95 border-2 border-[#ff4757] p-6 rounded-xl text-center">
        <h3 className="text-lg text-white mb-5">{msg}</h3>
        <button onClick={onClose} className="btn-primary">
          Tutup
        </button>
      </div>
    </div>
  );
}
