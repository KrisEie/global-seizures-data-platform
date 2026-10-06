import os
from pathlib import Path
import subprocess
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / '.env')
folder = Path(__file__).resolve().parents[1] / 'neo4j_db'
password = os.environ.get('NEO4J_PASSWORD')
if not password or password.startswith('REPLACE_'):
    raise RuntimeError('Set NEO4J_PASSWORD in the repository-root .env file.')
env = os.environ.copy()
env['NEO4J_PASSWORD'] = password
files = sorted(folder.glob('*.cql'))
ordered = ([folder / 'make_index.cql'] +
           [file for file in files if file.name not in ('make_index.cql', 'set_relations.cql')] +
           [folder / 'set_relations.cql'])
for file in ordered:
    if not file.is_file():
        continue
    print(f'Importing {file.name}')
    subprocess.run(['cypher-shell', '-a', os.environ.get('NEO4J_URI', 'bolt://127.0.0.1:7687'),
                    '-u', os.environ.get('NEO4J_USER', 'neo4j'), '-f', str(file)],
                   env=env, check=True)
