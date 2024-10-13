
import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import os from 'os';
import CryptoJS from 'crypto-js';
import axios from 'axios';

const currentDir = process.cwd();
const githubToken = process.env.GITHUB_TOKEN;

class EnvManager {
  constructor(repoOwner, repoName, githubToken) {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.githubToken = githubToken;
  }

  async isCollaborator(username) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/collaborators/${username}`,
        {
          headers: { Authorization: `token ${this.githubToken}` }
        }
      );
      return response.status === 204;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      throw error;
    }
  }

  getUsername() {
    return os.userInfo().username;
  }

  async encryptEnvFile(envFilePath, encryptedFilePath) {
    const username = this.getGithubUsername();
    const isCollaborator = await this.isCollaborator(username);

    if (!isCollaborator) {
      throw new Error('You are not a collaborator on this project.');
    }

    const fileContent = await readFile(envFilePath, 'utf8');
    const encryptedContent = CryptoJS.AES.encrypt(fileContent, username).toString();
    await writeFile(encryptedFilePath, encryptedContent);

    console.log(`File encrypted and saved to ${encryptedFilePath}`);
  }

  async decryptEnvFile(encryptedFilePath, decryptedFilePath) {
    const username = this.getGithubUsername();
    const isCollaborator = await this.isCollaborator(username);

    if (!isCollaborator) {
      throw new Error('You are not a collaborator on this project.');
    }

    const encryptedContent = await readFile(encryptedFilePath, 'utf8');
    const decryptedContent = CryptoJS.AES.decrypt(encryptedContent, username).toString(CryptoJS.enc.Utf8);
    await writeFile(decryptedFilePath, decryptedContent);

    console.log(`File decrypted and saved to ${decryptedFilePath}`);
  }

  getRepoInfo() {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
      const match = remoteUrl.match(/github\.com[:/](.+)\/(.+)\.git$/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
      throw new Error('Unable to parse GitHub repository information');
    } catch (error) {
      console.error('Error getting repository information:', error.message);
      return null;
    }
  }

  getGithubUsername () {
    try {
      const unserName = execSync('git config user.name').toString().trim();
      return unserName;
    } catch (error) {
      throw new Error('Failed to get GitHub username');
    }
  }
}

// Example usage
async function main() {
  const repoInfo = new EnvManager().getRepoInfo();
  if (!repoInfo) {
    console.error('Failed to get repository information');
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('GitHub token not found. Set the GITHUB_TOKEN environment variable.');
    return;
  }

  const manager = new EnvManager(repoInfo.owner, repoInfo.name, githubToken);

  try {
    await manager.encryptEnvFile('.env', '.env.encrypted');
    await manager.decryptEnvFile('.env.encrypted', '.env.decrypted');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();