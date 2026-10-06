import React, {useState} from 'react';
import './AddDataButton.css';

function AddDataButton({ dbType }) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const getFixedData = () => {
        switch(dbType) {
            case 'postgresql':
                return {
                    query: `INSERT INTO fact_seizures (seizure_id, date_id, global_location_id, spez_location_id, drug_id, transport_id, source_id, quantity)
                            VALUES (nextval('fact_seizures_seizure_id_seq'),
                                    3744,
                                    48,
                                    57024,
                                    115,
                                    7,
                                    1,
                                    8);
                    `,
                    description: "Produce new data entry:\nOn the 24.08.2015 in Badakhshan (Afghanistan) \nwhere found 8kg of Opium."
                };
            case 'mongodb':
                return {
                    query: `db.seizures.insertOne({
"Seizure Date": new Date("2015-08-24"),
"Country/Territory of Seizure": "Afghanistan",
"ISO3": "AFG",
"Region": "Asia",
"Subregion": "South-West Asia",
"City": null,
"Administrative Region": "Badakhshan",
"Drug/Substance": "Opium",
"Measurement Unit": "kg",
"Quantity Seized": 8,
"Physical Seizure Location": null,
"Trafficking Mode of Transportation": null,
"Source": "Government",
"Reporting Channel": "Individual Drug Seizures (IDS)",
"year": 2015
})`,
                    description: "Produce new data entry:\nOn the 24.08.2015 in Badakhshan (Afghanistan) \nwhere found 8kg of Opium."
                };
            case 'neo4j':
                return {
                    query: `MATCH (s:Seizures)
                            WITH COALESCE(MAX(s.seizure_id), 0) + 1 as nextId
                            CREATE (ns:Seizures {
                                seizure_id: toFloat(nextId),
                                date_id: toFloat(3744.0),
                                global_location_id: toFloat(48.0),
                                spez_location_id: toFloat(57024.0),
                                drug_id: toFloat(115.0),
                                transport_id: toFloat(7.0),
                                source_id: toFloat(1.0),
                                quantity: toFloat(8.0)
                            })
                            RETURN ns;`,
                    description: `Produce new data entry:
On the 24.08.2015 in Badakhshan (Afghanistan) 
where found 8kg of Opium.`
                };
            default:
                return { query: "", description: "No data available" };
        }
    };

    const handleAddData = async () => {
        const data = getFixedData();

        setIsLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await fetch(`http://localhost:5000/api/${dbType}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: data.query }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const result = await response.json();
            setResult({
                success: true,
                message: `Successfully added data to ${dbType}`,
                details: result
            });
        } catch (err) {
            setError({
                message: `Error adding data to ${dbType}`,
                details: err.message
            });
        } finally {
            setIsLoading(false);

            // Clear result/error after 5 seconds
            setTimeout(() => {
                setResult(null);
                setError(null);
            }, 5000);
        }
    };

    return (
        <div className="add-data-container">
            <button
                className="add-data-button"
                onClick={handleAddData}
                disabled={isLoading}
            >
                {isLoading ? 'Adding...' : '+ Produce Data'}
            </button>

            {result && (
                <div className="result-message success">
                    <p>{result.message}</p>
                </div>
            )}

            {error && (
                <div className="result-message error">
                    <p>{error.message}: {error.details}</p>
                </div>
            )}

            <div className="data-preview">
                <h4>Sample data that will be added:</h4>
                <pre>{getFixedData().description}</pre>
            </div>
        </div>
    );
}

export default AddDataButton;