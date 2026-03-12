# Kariana - AI-Powered Creative App Hub

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](./docker/HOW_TO_USE_DOCKER.md)
[![LLM Providers](https://img.shields.io/badge/LLM%20Providers-30+-purple)](https://github.com/INGIPSA/kariana-anythingllm)
[![MCP](https://img.shields.io/badge/MCP-Compatible-orange)](https://docs.kariana.com/mcp-compatibility/overview)
[![Docs](https://img.shields.io/badge/Docs-kariana.com-blue)](https://docs.kariana.com)

**Kariana** is the AI hub that connects your creative applications to any LLM. Chat with your docs, use AI Agents, connect to Unreal Engine with 218+ MCP tools, and manage everything from a single interface. Multi-user, hyper-configurable, and self-hostable.

## Features

### Core Features
- **Full MCP Compatibility** - Connect to any MCP-compatible tool server
- **DCC App Connections** - Direct integration with Unreal Engine, Blender, Houdini (coming soon)
- **No-Code AI Agent Builder** - Create custom agent workflows visually
- **Custom AI Agents** - Agents with web browsing, code execution, and tool use
- **Multi-Modal Support** - Images, documents, and text with both closed and open-source LLMs
- **Multi-User & Permissions** - Role-based access control with Clerk authentication
- **Document Workspaces** - Containerized RAG with PDF, TXT, DOCX, and more
- **Embeddable Chat Widget** - Drop-in chat for your website
- **Full Developer API** - REST API for custom integrations

### DCC App Integration

| App | Status | Tools | Description |
|-----|--------|-------|-------------|
| **Unreal Engine** | Available | 218+ | Full engine control via [KARIANA plugin](https://github.com/INGIPSA/KARIANA) |
| **Blender** | Coming Soon | - | 3D modeling and rendering |
| **Houdini** | Coming Soon | - | Procedural generation |

### Supported LLM Providers

| Category | Providers |
|----------|-----------|
| **Commercial** | OpenAI, Anthropic, AWS Bedrock, Azure OpenAI, Google Gemini, Mistral, Groq, Cohere, xAI, DeepSeek, Perplexity |
| **Open Source** | Ollama, LM Studio, LocalAI, KoboldCPP, llama.cpp, Text Generation Web UI, LiteLLM |
| **Routers** | OpenRouter, Together AI, Fireworks AI, Novita AI, PPIO, SambaNova Cloud |
| **Embedders** | Native Embedder (default), OpenAI, Azure OpenAI, Ollama, LM Studio, Cohere |
| **Vector DBs** | LanceDB (default), PGVector, Pinecone, Chroma, Weaviate, Qdrant, Milvus, Zilliz, Astra DB |
| **TTS/STT** | Native Browser, OpenAI TTS, ElevenLabs, PiperTTS |

## Installation

### Docker (Recommended)

```bash
git clone https://github.com/INGIPSA/kariana-anythingllm.git
cd kariana-anythingllm/docker
cp .env.example .env  # Edit with your settings
docker compose up -d --build
```

Then open [http://localhost:3001](http://localhost:3001).

### Development Setup

```bash
yarn setup          # Fill in .env files
yarn dev:server     # Start the server
yarn dev:frontend   # Start the frontend
yarn dev:collector  # Start the document collector
```

### Cloud Deployment

| Docker | AWS | GCP | Digital Ocean | Render.com |
|--------|-----|-----|---------------|------------|
| [![Deploy on Docker][docker-btn]][docker-deploy] | [![Deploy on AWS][aws-btn]][aws-deploy] | [![Deploy on GCP][gcp-btn]][gcp-deploy] | [![Deploy on DigitalOcean][do-btn]][do-deploy] | [![Deploy on Render.com][render-btn]][render-deploy] |

| Railway | RepoCloud | Elestio | Northflank |
|---------|-----------|---------|------------|
| [![Deploy on Railway][railway-btn]][railway-deploy] | [![Deploy on RepoCloud][repocloud-btn]][repocloud-deploy] | [![Deploy on Elestio][elestio-btn]][elestio-deploy] | [![Deploy on Northflank][northflank-btn]][northflank-deploy] |

[Or set up a production instance without Docker ->](./BARE_METAL.md)

## Quick Start with Unreal Engine

1. Install the [KARIANA plugin](https://github.com/INGIPSA/KARIANA) in Unreal Engine
2. Open your UE project (MCP servers start automatically on ports 8001 & 8002)
3. In Kariana, go to **Settings > Connections > Apps** and click **Connect** on Unreal Engine
4. Start chatting with your AI — it now has full control of the engine

## Documentation

| Section | Link |
|---------|------|
| Full Documentation | [docs.kariana.com](https://docs.kariana.com) |
| MCP Compatibility | [MCP Overview](https://docs.kariana.com/mcp-compatibility/overview) |
| Agent Flows | [Agent Builder](https://docs.kariana.com/agent-flows/overview) |
| Custom Agents | [Agent Docs](https://docs.kariana.com/agent/custom/introduction) |
| KARIANA Plugin | [GitHub](https://github.com/INGIPSA/KARIANA) |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Links

- **Website**: [kariana.app](https://kariana.app)
- **Documentation**: [docs.kariana.com](https://docs.kariana.com)
- **KARIANA Plugin**: [github.com/INGIPSA/KARIANA](https://github.com/INGIPSA/KARIANA)
- **Issues**: [GitHub Issues](https://github.com/INGIPSA/kariana-anythingllm/issues)
- **Discord**: [Join the community](https://discord.gg/6UyHPeGZAC)

---

Copyright &copy; 2026 [INGIPSA](https://github.com/INGIPSA). MIT Licensed.

<!-- LINK GROUP -->
[docker-btn]: ./images/deployBtns/docker.png
[docker-deploy]: ./docker/HOW_TO_USE_DOCKER.md
[aws-btn]: ./images/deployBtns/aws.png
[aws-deploy]: ./cloud-deployments/aws/cloudformation/DEPLOY.md
[gcp-btn]: https://deploy.cloud.run/button.svg
[gcp-deploy]: ./cloud-deployments/gcp/deployment/DEPLOY.md
[do-btn]: https://www.deploytodo.com/do-btn-blue.svg
[do-deploy]: ./cloud-deployments/digitalocean/terraform/DEPLOY.md
[render-btn]: https://render.com/images/deploy-to-render-button.svg
[render-deploy]: https://render.com/deploy?repo=https://github.com/INGIPSA/kariana&branch=render
[railway-btn]: https://railway.app/button.svg
[railway-deploy]: https://railway.app/template/HNSCS1?referralCode=WFgJkn
[repocloud-btn]: https://d16t0pc4846x52.cloudfront.net/deploylobe.svg
[repocloud-deploy]: https://repocloud.io/details/?app_id=276
[elestio-btn]: https://elest.io/images/logos/deploy-to-elestio-btn.png
[elestio-deploy]: https://elest.io/open-source/kariana
[northflank-btn]: https://assets.northflank.com/deploy_to_northflank_smm_36700fb050.svg
[northflank-deploy]: https://northflank.com/stacks/deploy-kariana
