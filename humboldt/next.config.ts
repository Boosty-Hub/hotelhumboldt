import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Comprime HTML y payloads RSC: importa con usuarios en redes venezolanas
  // de ancho de banda variable.
  compress: true,

  // No bundlear estos paquetes nativos/pesados con Turbopack.
  serverExternalPackages: ["@prisma/client", "prisma", "@react-pdf/renderer"],

  experimental: {
    // Tree-shaking de los barrels de íconos/charts/utilidades: reduce el JS que
    // el cliente descarga y parsea → hidratación más rápida tras el login.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
    ],
  },
};

export default nextConfig;
