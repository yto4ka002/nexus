import React, { useState } from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { ProjectTemplate } from '../../types';

interface ProjectTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
  isRu: boolean;
}

const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-vite-ts',
    title: 'React 19 + Vite + TypeScript',
    description: 'Современный веб-проект на React 19 с TypeScript, модульными стилями и быстрым HMR.',
    icon: 'react',
    color: '#8B6CFF',
    tags: ['React', 'TypeScript', 'Vite', 'Tailwind'],
    files: [
      {
        name: 'package.json',
        path: 'package.json',
        language: 'json',
        content: JSON.stringify(
          {
            name: 'nexus-react-app',
            private: true,
            version: '0.1.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'tsc -b && vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^19.0.0',
              'react-dom': '^19.0.0',
              'lucide-react': '^0.460.0',
            },
            devDependencies: {
              '@types/react': '^19.0.0',
              '@types/react-dom': '^19.0.0',
              '@vitejs/plugin-react': '^4.3.0',
              typescript: '~5.6.2',
              vite: '^6.0.0',
            },
          },
          null,
          2
        ),
      },
      {
        name: 'App.tsx',
        path: 'src/App.tsx',
        language: 'typescript',
        content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B0B0E',
      color: '#F1F1F5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        padding: '32px 48px',
        backgroundColor: '#16161C',
        border: '1px solid #25252D',
        borderRadius: 12,
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '1.8rem', color: '#8B6CFF', margin: '0 0 12px' }}>
          React 19 in NEXUS
        </h1>
        <p style={{ color: '#92929F', margin: '0 0 20px' }}>
          Fast modern React project initialized with NEXUS 1.1
        </p>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: '10px 24px',
            backgroundColor: '#8B6CFF',
            color: '#0B0B0E',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Count is {count}
        </button>
      </div>
    </div>
  );
}
`,
      },
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App - NEXUS</title>
  </head>
  <body style="margin: 0; background: #0B0B0E;">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: `# React 19 + TypeScript App\n\nBootstrapped with NEXUS Project Templates.\n\n### Run:\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      },
    ],
  },
  {
    id: 'node-api',
    title: 'Node.js Fastify / Express API',
    description: 'Быстрый REST API сервер на Node.js с TypeScript, роутами и валидацией.',
    icon: 'server',
    color: '#10b981',
    tags: ['Node.js', 'Fastify', 'TypeScript', 'REST API'],
    files: [
      {
        name: 'package.json',
        path: 'package.json',
        language: 'json',
        content: JSON.stringify(
          {
            name: 'nexus-node-api',
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'tsx watch src/server.ts',
              build: 'tsc',
              start: 'node dist/server.js',
            },
            dependencies: {
              fastify: '^5.0.0',
              '@fastify/cors': '^10.0.0',
            },
            devDependencies: {
              '@types/node': '^22.0.0',
              tsx: '^4.19.0',
              typescript: '^5.6.0',
            },
          },
          null,
          2
        ),
      },
      {
        name: 'server.ts',
        path: 'src/server.ts',
        language: 'typescript',
        content: `import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/api/health', async () => {
  return { status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() };
});

fastify.get('/api/projects', async () => {
  return [
    { id: 1, title: 'Sample API Project', status: 'active' },
  ];
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: `# Node.js REST API\n\nRuns on Fastify with TypeScript.\n\n### Run:\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      },
    ],
  },
  {
    id: 'python-fastapi',
    title: 'Python FastAPI Backend',
    description: 'Асинхронный Python бэкенд на FastAPI с Pydantic и автоматической Swagger документацией.',
    icon: 'terminal',
    color: '#06b6d4',
    tags: ['Python', 'FastAPI', 'Pydantic', 'Uvicorn'],
    files: [
      {
        name: 'main.py',
        path: 'main.py',
        language: 'python',
        content: `from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="NEXUS FastAPI Service", version="1.0.0")

class Item(BaseModel):
    id: int
    name: str
    price: float

items_db: List[Item] = [
    Item(id=1, name="Telemetry Sensor", price=149.99),
]

@app.get("/")
def read_root():
    return {"message": "Welcome to NEXUS FastAPI Service", "status": "online"}

@app.get("/items", response_model=List[Item])
def get_items():
    return items_db

@app.post("/items", response_model=Item)
def create_item(item: Item):
    items_db.append(item)
    return item
`,
      },
      {
        name: 'requirements.txt',
        path: 'requirements.txt',
        language: 'text',
        content: `fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\npydantic>=2.9.0\n`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: `# FastAPI Backend\n\n### Run:\n\`\`\`bash\npip install -r requirements.txt\nuvicorn main:app --reload\n\`\`\`\n`,
      },
    ],
  },
  {
    id: 'rust-cli',
    title: 'Rust CLI Tool',
    description: 'Высокопроизводительное системное консольное приложение на Rust с clap.',
    icon: 'terminal',
    color: '#f59e0b',
    tags: ['Rust', 'Cargo', 'CLI', 'Performance'],
    files: [
      {
        name: 'Cargo.toml',
        path: 'Cargo.toml',
        language: 'toml',
        content: `[package]
name = "nexus-cli"
version = "0.1.0"
edition = "2021"

[dependencies]
clap = { version = "4.5", features = ["derive"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`,
      },
      {
        name: 'main.rs',
        path: 'src/main.rs',
        language: 'rust',
        content: `use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "nexus")]
#[command(about = "High performance CLI tool crafted in NEXUS", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Ping the system
    Ping,
    /// Greet user
    Greet { name: String },
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Ping => {
            println!("PONG! NEXUS CLI engine is alive.");
        }
        Commands::Greet { name } => {
            println!("Hello, {}! Welcome to NEXUS.", name);
        }
    }
}
`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: `# Rust CLI Application\n\n### Run:\n\`\`\`bash\ncargo run -- ping\n\`\`\`\n`,
      },
    ],
  },
  {
    id: 'minimal-web',
    title: 'Minimal Modern Web (HTML/CSS/JS)',
    description: 'Чистый легковесный шаблон без сборщиков: семантический HTML, тёмная тема и ES6 скрипт.',
    icon: 'globe',
    color: '#ec4899',
    tags: ['HTML5', 'Modern CSS', 'ES6 JavaScript'],
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Minimal Web - NEXUS</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="card">
    <h1>NEXUS Project</h1>
    <p>Clean modern vanilla web template.</p>
    <button id="actionBtn">Click Me</button>
  </div>
  <script src="app.js"></script>
</body>
</html>
`,
      },
      {
        name: 'styles.css',
        path: 'styles.css',
        language: 'css',
        content: `body {
  margin: 0;
  background-color: #0B0B0E;
  color: #F1F1F5;
  font-family: Inter, system-ui, sans-serif;
  display: flex;
  height: 100vh;
  align-items: center;
  justify-content: center;
}

.card {
  background-color: #16161C;
  border: 1px solid #25252D;
  border-radius: 8px;
  padding: 32px 48px;
  text-align: center;
}

h1 {
  margin: 0 0 12px;
  color: #8B6CFF;
}

p {
  color: #92929F;
  margin-bottom: 24px;
}

button {
  padding: 10px 24px;
  background-color: #8B6CFF;
  border: none;
  border-radius: 6px;
  color: #0B0B0E;
  font-weight: 600;
  cursor: pointer;
}
`,
      },
      {
        name: 'app.js',
        path: 'app.js',
        language: 'javascript',
        content: `document.getElementById('actionBtn')?.addEventListener('click', () => {
  alert('Hello from NEXUS Minimal Web!');
});
`,
      },
    ],
  },
];

export const ProjectTemplatesModal: React.FC<ProjectTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  isRu,
}) => {
  const [selectedId, setSelectedId] = useState<string>('react-vite-ts');

  if (!isOpen) return null;

  const currentTemplate = TEMPLATES.find(t => t.id === selectedId) || TEMPLATES[0];

  const handleApply = () => {
    onSelectTemplate(currentTemplate);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          height: '80vh',
          backgroundColor: '#111115',
          border: '1px solid #25252D',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #25252D',
            backgroundColor: '#0B0B0E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: 'rgba(139, 108, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8B6CFF',
                border: '1px solid rgba(139, 108, 255, 0.25)',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#F1F1F5' }}>
                {isRu ? 'Шаблоны Проектов (Project Templates)' : 'Project Templates'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#92929F' }}>
                {isRu
                  ? 'Быстрый старт проектов с готовой архитектурой, файлами и зависимостями'
                  : 'Fast bootstrap with pre-configured project files, structure and dependencies'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#92929F',
              cursor: 'pointer',
              padding: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Template Cards & Preview */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Template choices */}
          <div
            style={{
              width: 320,
              borderRight: '1px solid #25252D',
              backgroundColor: '#0B0B0E',
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {TEMPLATES.map(tmpl => {
              const isSelected = tmpl.id === selectedId;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedId(tmpl.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    border: isSelected ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid #25252D',
                    backgroundColor: isSelected ? 'rgba(139, 108, 255, 0.1)' : '#111115',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#F1F1F5' }}>
                      {tmpl.title}
                    </span>
                    {isSelected && <CheckCircle2 size={16} color="#8B6CFF" />}
                  </div>

                  <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#92929F', lineHeight: 1.4 }}>
                    {tmpl.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tmpl.tags.map(t => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.64rem',
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: '#16161C',
                          color: '#A78BFA',
                          border: '1px solid #25252D',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Template file tree preview */}
          <div
            style={{
              flex: 1,
              padding: 20,
              backgroundColor: '#111115',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#F1F1F5' }}>
                {currentTemplate.title}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#92929F', lineHeight: 1.5 }}>
                {currentTemplate.description}
              </p>
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#A78BFA',
                  marginBottom: 8,
                }}
              >
                {isRu ? 'Создаваемые файлы структуры:' : 'Files included in this template:'}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentTemplate.files.map(f => (
                  <div
                    key={f.path}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#16161C',
                      border: '1px solid #25252D',
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.76rem', color: '#F1F1F5', fontFamily: 'monospace' }}>
                      {f.path}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#686877' }}>
                      {f.language} • {f.content.split('\n').length} lines
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #25252D',
            backgroundColor: '#0B0B0E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              backgroundColor: 'transparent',
              border: '1px solid #25252D',
              borderRadius: 6,
              color: '#92929F',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {isRu ? 'Отмена' : 'Cancel'}
          </button>
          <button
            onClick={handleApply}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 20px',
              backgroundColor: '#8B6CFF',
              border: 'none',
              borderRadius: 6,
              color: '#0B0B0E',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={14} />
            {isRu ? 'Применить шаблон' : 'Apply Template'}
          </button>
        </div>
      </div>
    </div>
  );
};
