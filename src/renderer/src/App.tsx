// Placeholder screen for T01. The design system arrives in T07 and the real
// home screen in T08; until then this only proves the renderer boots.
function App(): React.JSX.Element {
  return (
    <main
      data-testid="app-root"
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#f3efe6',
        color: '#1d2320',
        fontFamily: 'Georgia, serif'
      }}
    >
      <h1 style={{ fontSize: 48, lineHeight: '48px', fontWeight: 600, margin: 0 }}>WebAtlas</h1>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#4f5a55', margin: 0 }}>
        Project setup is complete. The interface is built in the next tasks.
      </p>
    </main>
  )
}

export default App
