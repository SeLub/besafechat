interface MethodSelectionProps {
  onSelectCloud: () => void;
  onSelectSelfCustody: () => void;
}

export function MethodSelection({ onSelectCloud, onSelectSelfCustody }: MethodSelectionProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-8">Choose Your Security Level</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cloud Recovery */}
        <div className="border-2 border-orange-500 rounded-lg p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Cloud Recovery</h3>
            <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm">
              Security: 75% 🟠
            </span>
          </div>

          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Easy login with password</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Access from any device</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Seed encrypted in your cloud</span>
            </li>
            <li className="flex items-start text-orange-600">
              <span className="mr-2">⚠️</span>
              <span>Need password + backup file</span>
            </li>
          </ul>

          <button
            onClick={onSelectCloud}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition"
          >
            Select Cloud Recovery
          </button>
        </div>

        {/* Self-Custody */}
        <div className="border-2 border-green-500 rounded-lg p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Self-Custody</h3>
            <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm">
              Security: 100% 🟢
            </span>
          </div>

          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Maximum security</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>No cloud storage</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Full control over keys</span>
            </li>
            <li className="flex items-start text-orange-600">
              <span className="mr-2">⚠️</span>
              <span>Need seed phrase every time</span>
            </li>
          </ul>

          <button
            onClick={onSelectSelfCustody}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition"
          >
            Select Self-Custody
          </button>
        </div>
      </div>
    </div>
  );
}
