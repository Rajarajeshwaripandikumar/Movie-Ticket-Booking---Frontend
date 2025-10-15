// src/components/GlobalBackdrop.jsx
export default function GlobalBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
    >
      {/* Soft gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F6FAFF] to-[#EAF3FF]" />

      {/* Optional subtle texture from /public (replace filename as needed) */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-multiply"
        style={{
          backgroundImage: "url('/Background.png')", // put bg-pattern.png in /public
          backgroundRepeat: "repeat",
          backgroundSize: "1200px auto",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}
