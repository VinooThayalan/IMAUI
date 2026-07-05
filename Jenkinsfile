pipeline {
  agent any

  environment {
    IMAGE_NAME = 'imaui'
    DEPLOY_DIR = '/var/www/imaui'
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    skipDefaultCheckout(false)
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build Frontend') {
      steps {
        withCredentials([
          string(credentialsId: 'vite-supabase-url', variable: 'VITE_SUPABASE_URL'),
          string(credentialsId: 'vite-supabase-anon-key', variable: 'VITE_SUPABASE_ANON_KEY')
        ]) {
          sh '''
            set -euo pipefail
            docker run --rm \
              -e VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
              -e VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
              -v "$PWD:/app" \
              -w /app \
              node:20-alpine sh -lc "npm ci && npm run build"
          '''
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        withCredentials([
          string(credentialsId: 'vite-supabase-url', variable: 'VITE_SUPABASE_URL'),
          string(credentialsId: 'vite-supabase-anon-key', variable: 'VITE_SUPABASE_ANON_KEY')
        ]) {
          sh '''
            set -euo pipefail
            IMAGE_TAG="${GIT_COMMIT:-$(git rev-parse --short HEAD)}"
            docker buildx create --use --name imaui-builder 2>/dev/null || true
            docker buildx use imaui-builder
            docker buildx build \
              --pull \
              --load \
              --cache-from=type=local,src=/tmp/.buildx-cache \
              --cache-to=type=local,dest=/tmp/.buildx-cache-new,mode=max \
              --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
              --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
              -t ${IMAGE_NAME}:${IMAGE_TAG} \
              -t ${IMAGE_NAME}:latest \
              .
          '''
        }
      }
    }

    stage('Deploy to VM') {
      steps {
        withCredentials([
          string(credentialsId: 'vite-supabase-url', variable: 'VITE_SUPABASE_URL'),
          string(credentialsId: 'vite-supabase-anon-key', variable: 'VITE_SUPABASE_ANON_KEY')
        ]) {
          sh '''
            set -euo pipefail
            IMAGE_TAG="${GIT_COMMIT:-$(git rev-parse --short HEAD)}"
            # DEPLOY_DIR must be owned/writable by the jenkins user.
            # One-time host setup: sudo chown -R jenkins:jenkins /var/www/imaui
            # mkdir -p is a no-op when the directory already exists.
            mkdir -p "${DEPLOY_DIR}"
            cp docker-compose.yml "${DEPLOY_DIR}/docker-compose.yml"
            cat > "${DEPLOY_DIR}/.env" <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
EOF
            cd "${DEPLOY_DIR}"
            export IMAGE_NAME="${IMAGE_NAME}"
            export IMAGE_TAG="${IMAGE_TAG}"
            export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}"
            export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"
            # Image was already built and --load-ed into Docker in the previous
            # stage; the deploy dir has no source, so do NOT pass --build here.
            docker compose up -d --force-recreate --remove-orphans web
            docker compose ps
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'rm -rf /tmp/.buildx-cache && mv /tmp/.buildx-cache-new /tmp/.buildx-cache 2>/dev/null || true'
      echo 'Pipeline completed.'
    }
    success {
      echo 'Deployment successful.'
    }
    failure {
      echo 'Deployment failed.'
    }
  }
}
