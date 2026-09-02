# Production deployment guide for IMAUI

## 1. Recommended architecture

Use a dedicated Linux VM with:
- Docker Engine
- Docker Compose plugin
- Jenkins for CI/CD
- Optional reverse proxy such as Caddy or Nginx for TLS termination
- A non-root deploy user
- UFW firewall
- Fail2ban
- Automatic OS updates

The current app deployment uses Jenkins on the VM to build and deploy the container automatically from GitHub.

## 2. VM hardening checklist

### Create a deploy user
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### Disable root SSH login and password auth
Edit /etc/ssh/sshd_config:
```bash
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Then reload SSH:
```bash
sudo systemctl restart sshd
```

### Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2ban
```bash
sudo apt update
sudo apt install -y fail2ban
sudo systemctl enable fail2ban --now
```

## 3. Install Docker on the VM

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker --now
sudo usermod -aG docker deploy
```

## 4. Deploy the app with Jenkins

1. Create the deployment directory:
```bash
sudo mkdir -p /var/www/imaui
```

2. Create the environment file:
```bash
cat > /var/www/imaui/.env <<'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
```

3. Configure the Jenkins pipeline to use the repository's Jenkinsfile.
4. Add a GitHub PAT credential of type Username with password for SCM checkout.
5. Add the build variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the job.
6. Run the job to build and deploy.

## 5. TLS with Caddy (optional)

Install Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create /etc/caddy/Caddyfile:
```caddyfile
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

Then:
```bash
sudo systemctl enable caddy --now
```

## 6. Recommended production practices

- Use immutable image tags instead of latest in CI/CD.
- Keep secrets in environment variables or a secret manager.
- Run containers as non-root users (the image already does this).
- Use healthchecks and container restarts.
- Keep the app stateless; store dynamic data in Supabase.
- Enable logging and retention.
- Use a reverse proxy for TLS and request handling.
- Continue using Jenkins as the deployment automation layer.

## 7. Useful commands

```bash
sudo docker compose -f /var/www/imaui/docker-compose.yml ps
sudo docker compose -f /var/www/imaui/docker-compose.yml logs -f web
sudo docker compose -f /var/www/imaui/docker-compose.yml pull
sudo docker compose -f /var/www/imaui/docker-compose.yml up -d --build
sudo docker compose -f /var/www/imaui/docker-compose.yml down
```
