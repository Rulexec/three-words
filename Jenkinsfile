pipeline {
	agent none

	stages {
		stage('Build') {
			agent {
				docker {
					image 'node:12.16.1-buster'
				}
			}
			environment {
				npm_config_cache = "${env.JENKINS_HOME}/.npm"
				CACHE_DIR = "${env.JENKINS_HOME}/three-words-cache"
			}
			steps {
				sh 'npm run npm-ci-cached'
				sh 'rm -rf web/dist'
				sh 'npm run build-web'
			}

			post {
				always {
					archiveArtifacts artifacts: 'web/dist/**/*', onlyIfSuccessful: true
				}
			}
		}

		stage('Deploy') {
			agent {
				docker {
					image 'debian-ansible:2'
					args '-v /etc/passwd:/etc/passwd:ro'
				}
			}

			environment {
				HOME = "${env.WORKSPACE}/.jenkinsDeployHome"
				ANSIBLE_SSH_ARGS = "-C -o ControlMaster=auto -o ControlPersist=60s -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
			}

			steps {
				configFileProvider([configFile(fileId: 'ansible_hosts', variable: 'ANSIBLE_HOSTS')]) {
					withCredentials([sshUserPrivateKey(credentialsId: "jenkins-key", keyFileVariable: 'sshFile')]) {
						sh "ansible-playbook \
							-i ${ANSIBLE_HOSTS} \
							--key-file ${sshFile} \
							build-scripts/ansible/deploy.yml"
					}
				}
			}
		}
	}
}
