// Skip react-test-renderer peer dependency check (monorepo version mismatch)
process.env.RNTL_SKIP_PEER_DEPS = "true";

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@clerk/.*|@niftygifty/.*)",
    // Don't ignore our local packages (symlinked via file:)
    "!../../packages/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@niftygifty/types$": "<rootDir>/../../packages/types/dist/index.js",
    "^@niftygifty/api-client$": "<rootDir>/../../packages/api-client/dist/index.js",
    "^@niftygifty/services$": "<rootDir>/../../packages/services/dist/index.js",
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
