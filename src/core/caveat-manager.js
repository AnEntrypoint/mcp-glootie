import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const CAVEATS_FILE = './glootie/.caveats.txt';

function loadCaveats() {
  try {
    if (!existsSync(CAVEATS_FILE)) {
      return [];
    }

    const content = readFileSync(CAVEATS_FILE, 'utf8');
    const lines = content.trim().split('\n\n');
    return lines.filter(line => line.trim()).map(line => {
      const match = line.match(/^\[(.*?)\]\s*(.*?)\s*\(Recorded: (.*?)\)$/);
      if (match) {
        return {
          id: match[1],
          text: match[2].trim(),
          timestamp: new Date(match[3]).toISOString()
        };
      }
      const fallbackMatch = line.match(/^(.*?)\s*\(Recorded: (.*?)\)$/);
      if (fallbackMatch) {
        return {
          id: Date.now().toString(),
          text: fallbackMatch[1].trim(),
          timestamp: new Date(fallbackMatch[2]).toISOString()
        };
      }
      return {
        id: Date.now().toString(),
        text: line.trim(),
        timestamp: new Date().toISOString()
      };
    });
  } catch (error) {
    return [];
  }
}

function saveCaveats(caveats) {
  try {
    const content = caveats.map(caveat =>
      `[${caveat.id}] ${caveat.text} (Recorded: ${new Date(caveat.timestamp).toLocaleDateString()})`
    ).join('\n\n');
    writeFileSync(CAVEATS_FILE, content);
  } catch (error) {
    throw new Error(`Failed to save caveats: ${error.message}`);
  }
}

export function getAllCaveats() {
  return loadCaveats();
}

export function addCaveat(caveatText) {
  if (!caveatText || typeof caveatText !== 'string' || caveatText.trim().length === 0) {
    throw new Error('Caveat text is required and must be a non-empty string');
  }

  const caveats = loadCaveats();
  const newCaveat = {
    id: `cav_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    text: caveatText.trim(),
    timestamp: new Date().toISOString()
  };

  caveats.push(newCaveat);
  saveCaveats(caveats);

  return newCaveat;
}

export function deleteCaveat(caveatId) {
  if (!caveatId) {
    throw new Error('Caveat ID is required');
  }

  const caveats = loadCaveats();
  const initialLength = caveats.length;

  const filteredCaveats = caveats.filter(c => c.id !== caveatId);

  if (filteredCaveats.length === initialLength) {
    throw new Error(`Caveat with ID '${caveatId}' not found`);
  }

  saveCaveats(filteredCaveats);
  return true;
}

export function deleteCaveatByText(caveatText) {
  if (!caveatText) {
    throw new Error('Caveat text is required');
  }

  const caveats = loadCaveats();
  const initialLength = caveats.length;

  const filteredCaveats = caveats.filter(c => !c.text.includes(caveatText));

  if (filteredCaveats.length === initialLength) {
    throw new Error(`Caveat with text '${caveatText}' not found`);
  }

  saveCaveats(filteredCaveats);
  return true;
}

export function formatCaveatsForDisplay() {
  const caveats = loadCaveats();

  if (caveats.length === 0) {
    return '';
  }

  let output = '\n\n=== RECORDED CAVEATS ===\n';

  caveats.forEach((caveat, index) => {
    output += `\n${index + 1}. ${caveat.text}\n   (Recorded: ${new Date(caveat.timestamp).toLocaleDateString()})`;
  });

  return output + '\n';
}