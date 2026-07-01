/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mémoïsation automatique des composants (useMemo/useCallback implicites)
  reactCompiler: true,
};

export default nextConfig;
