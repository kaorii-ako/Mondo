# VPS Setup (DigitalOcean)

1. Create $12/mo droplet (2 vCPU, 4 GB RAM), Ubuntu 22.04
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
4. Pull models:
   ```
   ollama pull qwen3.5:9b
   ollama pull qwen3.6:27b
   ```
5. Set env vars in `/etc/environment`:
   ```
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_CONCURRENCY=2
   REDIS_URL=redis://localhost:6379
   OLLAMA_MODEL_FREE=qwen3.5:9b
   OLLAMA_MODEL_PRO=qwen3.6:27b
   ```
6. Run worker:
   ```
   docker build -f workers/Dockerfile -t anytutor-worker .
   docker run -d --restart always --env-file /etc/environment anytutor-worker
   ```
7. Expose Ollama (for Vercel API routes to reach it):
   - Set `OLLAMA_HOST=0.0.0.0` in Ollama systemd service
   - Add firewall rule: allow port 11434 from Vercel IP ranges only
