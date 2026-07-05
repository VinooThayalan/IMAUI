# Jenkins deployment guide

This document reflects the current deployment flow used by the repository: Jenkins runs the pipeline on the VM, builds the frontend, builds the Docker image, and deploys it to /var/www/imaui with Docker Compose.

## 1. Install Jenkins on the VM

For AlmaLinux 9:

```bash
sudo dnf install -y java-17-openjdk
curl -fsSL https://pkg.jenkins.io/redhat-stable/jenkins.repo | sudo tee /etc/yum.repos.d/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
sudo dnf install -y jenkins
sudo systemctl enable --now jenkins
sudo systemctl status jenkins --no-pager
```

Open the Jenkins UI:

```text
http://<vm-ip>:8080
```

## 2. Unlock Jenkins

1. Retrieve the administrator password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

2. Paste it into the browser and finish the setup.

## 3. Install required plugins

Install these plugins:
- GitHub plugin
- Pipeline plugin
- Docker Pipeline plugin
- GitHub Branch Source plugin (optional but useful)

## 4. Create the pipeline job

Create a new item as a Pipeline job.

Set the pipeline definition to:
- Pipeline script from SCM
- SCM: Git
- Repository URL: https://github.com/VinooThayalan/IMAUI.git
- Branch: main
- Script Path: Jenkinsfile

## 5. Configure GitHub credentials

Create a Jenkins credential of type Username with password for GitHub checkout.

Use:
- Username: your GitHub username
- Password: your GitHub PAT

This is the credential that Jenkins should use for the SCM checkout step.

## 6. Configure build environment variables

The pipeline expects these environment variables at runtime:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

You can add them in the Jenkins job under Build Environment or as Jenkins credentials referenced by the job.

## 7. GitHub webhook setup

To trigger builds automatically on every push:

1. Open your GitHub repository settings
2. Go to Webhooks
3. Add a webhook
4. Set the Payload URL to:

```text
http://<vm-ip>:8080/github-webhook/
```

5. Set the content type to application/json
6. Select Just the push event
7. Save

## 8. Deployment behavior

The current Jenkinsfile performs these steps:
1. Checks out the repository from GitHub
2. Runs npm ci
3. Builds the frontend with npm run build
4. Builds the Docker image
5. Copies docker-compose.yml and the environment file to /var/www/imaui
6. Runs docker compose up -d --build

The deployment target directory is:

```bash
/var/www/imaui
```

## 9. Notes

- The app container serves the built frontend directly and does not require Nginx inside the container.
- If you want TLS, place an external reverse proxy such as Caddy or Nginx in front of the VM.
- Keep secrets in Jenkins Credentials rather than in the repository.
