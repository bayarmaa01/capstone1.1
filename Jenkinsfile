pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'bayarmaa'
        DOCKER_HUB_PASS = credentials('dockerhub-credentials')
        APP_NAME = 'attendance-system'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/bayarmaa01/capstone1.1.git'
            }
        }

        stage('Build Docker Images') {
            steps {
                sh 'docker build -t $DOCKER_HUB_USER/$APP_NAME-backend ./backend'
                sh 'docker build -t $DOCKER_HUB_USER/$APP_NAME-frontend ./frontend'
                sh 'docker build -t $DOCKER_HUB_USER/$APP_NAME-face-service ./face-service'
            }
        }

        stage('Push to DockerHub') {
            steps {
                sh 'echo $DOCKER_HUB_PASS | docker login -u $DOCKER_HUB_USER --password-stdin'
                sh 'docker push $DOCKER_HUB_USER/$APP_NAME-backend'
                sh 'docker push $DOCKER_HUB_USER/$APP_NAME-frontend'
                sh 'docker push $DOCKER_HUB_USER/$APP_NAME-face-service'
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                docker compose down || true
                docker compose up -d --build
                docker image prune -f
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
        }
        failure {
            echo '❌ Deployment failed.'
        }
    }
}
