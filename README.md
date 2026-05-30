# OpenRouter to TokenMix proxy

Lightweight reverse proxy that translates the [OpenRouter](https://openrouter.ai) API format into [TokenMix](https://tokenmix.ai) API calls.

## Usage

### Native

```bash
bun install
cp .env.example .env

# Development (watch mode)
bun run dev

# Production
bun start
```

### Docker

```bash
# Build dist bundle first
bun build src/index.ts --outdir dist --target bun

# Start (reads TOKENMIX_API_KEY from .env)
docker compose up -d
```

## Endpoints

| OpenRouter path | TokenMix path |
| --- | --- |
| `/chat/completions` | → `/v1/chat/completions` |
| `/api/v1/chat/completions` | → `/v1/chat/completions` |
| `/v1/chat/completions` | → `/v1/chat/completions` (passthrough) |

## Model naming

Provider prefix is stripped automatically:

| OpenRouter | Tokenmix |
| --- | --- |
| deepseek/deepseek-v4-flash | deepseek-v4-flash |
| openai/gpt-4o | gpt-4o |
| anthropic/claude-3 | claude-3 |

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `TOKENMIX_API_KEY` | — | API key (required unless sent in request `Authorization` header) |
| `TOKENMIX_HOST` | `api.tokenmix.ai` | Upstream host |
| `PORT` | `8080` | Listen port |

## Development

```bash
bun run typecheck
bun run lint
```

## License

MIT

---

**Built with 💜 by [Leon135](https://leon135.xyz)**
