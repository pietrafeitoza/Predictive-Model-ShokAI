
# ShokAI - Predictive Model

ShokAI is a web-based predictive analytics platform designed to estimate demand for specialized breast cancer care in Brazil's private health insurance market. By processing open data from the National Supplementary Health Agency (ANS) across the North Region, it provides Market Access teams with actionable forecasts and interactive dashboards to prioritize strategic opportunities.

https://youtu.be/Zcmj_CLbibA

## Features

- Time-aware predictive modeling for health plan billing demand
- Automated data pipeline for ANS open data ingestion
- Clinical mapping of procedures and medicines using TUSS and SBOC guidance
- Health plan operator activity segmentation and opportunity tiering
- Interactive dashboard with filters, charts, and opportunity ranking
- Reproducible pipeline runner with full execution tracking

## Tech Stack

### Data Science & Predictive Model
- Python 3.12+
- Pandas / NumPy
- Scikit-learn
- SHAP
- Jupyter Notebooks

### Frontend
- React
- Vite
- TypeScript

### Backend & Infrastructure
- Node.js
- Express
- TypeScript
- Supabase / PostgreSQL

## Project Structure

```text
.
├── assets/
├── data/
│   ├── raw/
│   ├── interim/
│   ├── processed/
│   └── reference/
├── documents/
│   ├── documentation.md
│   └── extras/
├── notebooks/
│   ├── data_pipeline/
│   └── *.ipynb
├── scripts/
├── Dashboard/
│   ├── backend/
│   ├── frontend/
│   ├── packages/contracts/
│   ├── scripts/
│   └── supabase/
└── requirements.txt

```

## Getting Started

### Prerequisites

* Python 3.12+
* Node.js 18+
* npm
* Git

### Installation

Clone the repository and install the dependencies for both the Python environment and the dashboard web application:

```bash
git clone <repository-url>
cd shokai

# Set up Python environment
python -m venv .venv

# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt

# Windows
.venv\Scripts\activate
pip install -r requirements.txt

# Set up Dashboard dependencies
cd Dashboard
npm install

```

### Environment

Copy the example environment file and configure the required variables.

```bash
cp .env.example .env

```

### Data Pipeline & Predictive Model

Run the data pipeline and execute the notebooks automatically from the repository root:

```bash
python scripts/run_pipeline.py

```

*Note: The script automatically downloads public ANS data into the `data/` directory.*

### Running the Dashboard

To start the interactive dashboard locally from the `Dashboard` directory:

```bash
cd Dashboard
npm run dev

```

## Testing

Backend

```bash
cd Dashboard/backend
npm test

```

Frontend

```bash
cd Dashboard/frontend
npm test

```

## License

This project is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) License.

```

```
