import { useState } from 'react';
import { WebCutEditor } from 'webcut/react';
import 'webcut/react/style.css';

export default function App() {
    const [dark, setDark] = useState<boolean | null>(null);

    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* 受控暗色模式：v-model:darkMode 桥接为 darkMode + onUpdateDarkMode */}
            <WebCutEditor
                projectId="example-project"
                darkMode={dark}
                onUpdateDarkMode={setDark}
                header={<div style={{ padding: '8px 16px', fontWeight: 600 }}>WebCut in React (veaury)</div>}
            />
        </div>
    );
}
