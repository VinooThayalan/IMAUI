pipeline {
  agent any

  environment {
    IMAGE_NAME = 'imaui'
    REGISTRY = 'localhost/imaui'
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

    stage('Install Dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Build Frontend') {
      steps {
        withEnv(['VITE_SUPABASE_URL=' + env.VITE_SUPABASE_URL, 'VITE_SUPABASE_ANON_KEY=' + env.VITE_SUPABASE_ANON_KEY]) {
          sh 'npm run build'
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        sh 'docker build -t ${REGISTRY}:latest .'
      }
    }

    stage('Deploy to VM') {
      steps {
        sh '''
          mkdir -p ${DEPLOY_DIR}
          cp docker-compose.yml ${DEPLOY_DIR}/docker-compose.yml
          if [ -f .env ]; then
            cp .env ${DEPLOY_DIR}/.env
          else
            cp .env.example ${DEPLOY_DIR}/.env
          fi
          cd ${DEPLOY_DIR}
          docker compose pull || true
          docker compose up -d --build
          docker ps --filter name=imaui-web
        '''
      }
    }
  }

  post {
    always {
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
