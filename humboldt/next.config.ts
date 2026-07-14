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

  async headers() {
    return [
      {
        // Permite que Boosty Hub embeba la app en su iframe workspace.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://boosty-projects-hub.netlify.app",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
