import { useState } from 'react';

import { useModelExplainability } from '../../hooks/useModelExplainability';
import type { DashboardApiService } from '../../services/dashboard.service';
import '../../styles/model-explainability.css';

interface Props {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function ModelExplainabilityContent({ accessToken, onUnauthorized, service }: Props) {
  const { response, error, isLoading, retry } = useModelExplainability(
    service, accessToken, onUnauthorized,
  );
  const [selectedExample, setSelectedExample] = useState(0);
  const [selectedTrend, setSelectedTrend] = useState(0);

  if (isLoading) return <div className="explain-state" role="status">Loading model analysis…</div>;
  if (error) return (
    <div className="explain-state" role="alert">
      <p>We could not load the model analysis.</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
  if (!response?.data) return (
    <div className="explain-state" role="status">
      Explainability is unavailable for the currently selected model version.
    </div>
  );

  const analysis = response.data;
  const example = analysis.localExamples[selectedExample] ?? analysis.localExamples[0];
  const leadingFeatures = analysis.features.slice(0, 2);
  const leadingShare = leadingFeatures.reduce((total, feature) => total + feature.sharePercent, 0);
  const barFigure = analysis.globalFigures.find((figure) => figure.kind === 'bar');
  const otherFigures = analysis.globalFigures.filter((figure) => figure.kind !== 'bar');

  return (
    <div className="explain-page">
      {response.meta.source === 'mock' ? (
        <div className="explain-preview-note" role="note">
          Published Random Forest analysis · This view is independent of the mock dashboard predictions.
        </div>
      ) : null}

      <section className="explain-hero" aria-labelledby="explain-overview-title">
        <span className="explain-overline">Random Forest / {analysis.modelVersion} / Model explainability</span>
        <h2 id="explain-overview-title">Why did the model predict that volume?</h2>
        <p>The model starts from a reference value, then adjusts its estimate based on recent demand and other inputs. SHAP shows how much each input moved a forecast up or down.</p>
        <span className="explain-method">Based on {analysis.method} · {analysis.targetUnit}</span>
      </section>

      <div className="explain-at-a-glance" aria-label="Analysis at a glance">
        <div><span className="explain-overline">Main finding</span><strong>{leadingShare.toFixed(1)}%</strong><p>of the measured feature impact comes from the {leadingFeatures.length === 1 ? 'leading input' : 'two leading inputs'}.</p></div>
        <div><span className="explain-overline">Starting point</span><strong>{number.format(analysis.expectedValue)}</strong><p>billed items per month before feature contributions are added.</p></div>
        <div><span className="explain-overline">Evidence</span><strong>{analysis.sampleSize.toLocaleString('en-US')}</strong><p>sampled rows from a {analysis.holdoutSize.toLocaleString('en-US')}-row holdout, used for the overview charts.</p></div>
      </div>

      <section className="explain-section" aria-labelledby="explain-global-title">
        <div className="explain-section-head">
          <span className="explain-overline">01 / Across the model</span>
          <h2 id="explain-global-title">The largest input effects</h2>
          <p>This chart measures the size of each input's influence across the sample, regardless of direction.</p>
        </div>

        {barFigure ? (
          <figure className="explain-card explain-figure explain-wide-figure">
            <div className="explain-card-head"><h3>{barFigure.title}</h3><span>Average impact</span></div>
            <div className="explain-image-scroll" tabIndex={0} role="region" aria-label="Overall feature impact chart, scroll horizontally if needed">
              <img src={barFigure.imagePath} alt={barFigure.alt} />
            </div>
            <figcaption>{barFigure.caption}</figcaption>
          </figure>
        ) : null}
        <details className="explain-details"><summary>See the exact feature values</summary>
          <div className="explain-feature-table-wrap"><table><thead><tr><th scope="col">Input</th><th scope="col">Average absolute impact</th><th scope="col">Share</th></tr></thead><tbody>
            {analysis.features.map((feature) => <tr key={feature.name}><th scope="row">{feature.name}</th><td>{number.format(feature.meanAbsoluteShap)} items / month</td><td>{feature.sharePercent.toFixed(1)}%</td></tr>)}
          </tbody></table></div>
        </details>
      </section>

      {otherFigures.map((figure, index) => (
        <section className="explain-section" aria-labelledby={`explain-figure-title-${index}`} key={figure.imagePath}>
          <div className="explain-section-head">
            <span className="explain-overline">{String(index + 2).padStart(2, '0')} / {figure.kind === 'beeswarm' ? 'Direction' : 'Feature behavior'}</span>
            <h2 id={`explain-figure-title-${index}`}>{figure.kind === 'beeswarm' ? 'Do inputs raise or lower a forecast?' : 'How do the leading inputs behave?'}</h2>
            <p>{figure.kind === 'beeswarm'
              ? 'Each dot is one historical row. Dots to the right raised that forecast; dots to the left lowered it. Colour indicates whether the input value was high or low.'
              : 'Choose one input to inspect its relationship with the forecast. The original three-chart figure remains available at full size.'}</p>
          </div>
          <figure className="explain-card explain-figure explain-wide-figure">
            <div className="explain-card-head"><h3>{figure.title}</h3>
              <a href={figure.imagePath} target="_blank" rel="noopener noreferrer">Open original chart</a>
            </div>
            {figure.kind === 'dependence' ? (
              <>
                <div className="explain-trend-controls" aria-label="Choose an input to inspect">
                  {figure.panels.map(({ label }, trendIndex) => <button key={label} type="button" aria-pressed={trendIndex === selectedTrend} onClick={() => setSelectedTrend(trendIndex)}>{label}</button>)}
                </div>
                <div className="explain-image-scroll" tabIndex={0} role="region" aria-label={`${figure.panels[Math.min(selectedTrend, figure.panels.length - 1)].label} chart, scroll horizontally if needed`}>
                  <div className="explain-trend-window" style={{ aspectRatio: figure.panelAspectRatio }}>
                    <img className="explain-trend-image" style={{ left: `-${Math.min(selectedTrend, figure.panels.length - 1) * 100}%`, width: `${figure.panels.length * 100}%` }} src={figure.imagePath} alt={`SHAP dependence for ${figure.panels[Math.min(selectedTrend, figure.panels.length - 1)].label.toLowerCase()}`} />
                  </div>
                </div>
              </>
            ) : (
              <div className="explain-image-scroll" tabIndex={0} role="region" aria-label={`${figure.title} chart, scroll horizontally if needed`}><img src={figure.imagePath} alt={figure.alt} /></div>
            )}
            <figcaption>{figure.caption}</figcaption>
          </figure>
        </section>
      ))}

      <section className="explain-section" aria-labelledby="explain-local-title">
        <div className="explain-section-head">
          <span className="explain-overline">{String(otherFigures.length + 2).padStart(2, '0')} / Historical examples</span>
          <h2 id="explain-local-title">See one prediction step by step</h2>
          <p>Choose a past case. Its waterfall starts at the reference prediction and shows how each input moved the estimate. These are examples, not live explanations of dashboard rows.</p>
        </div>
        <div className="explain-example-list" aria-label="Choose a historical explanation">
          {analysis.localExamples.map((item, index) => (
            <button
              type="button"
              key={item.imagePath}
              className={index === selectedExample ? 'explain-example-button is-selected' : 'explain-example-button'}
              aria-pressed={index === selectedExample}
              onClick={() => setSelectedExample(index)}
            >
              <span>{item.title}</span>
              <small>{item.context}</small>
            </button>
          ))}
        </div>
        <figure className="explain-card explain-figure explain-example-figure">
          <div className="explain-card-head"><h3>{example.title}</h3><span>{example.context}</span></div>
          <div className="explain-case-values">
            <span>Predicted <strong>{number.format(example.predicted)}</strong></span>
            <span>Observed <strong>{number.format(example.observed)}</strong></span>
            <span>billed items / month</span>
          </div>
          <div className="explain-image-scroll" tabIndex={0} role="region" aria-label="Historical SHAP waterfall, scroll horizontally if needed"><img src={example.imagePath} alt={example.alt} /></div>
          <figcaption>{example.caption}</figcaption>
        </figure>
      </section>

      <section className="explain-section explain-limits" aria-labelledby="explain-limits-title">
        <div className="explain-section-head">
          <span className="explain-overline">{String(otherFigures.length + 3).padStart(2, '0')} / Interpretation</span>
          <h2 id="explain-limits-title">What this explanation does not say</h2>
          <p>SHAP describes how this model arrived at its estimates. It does not validate a clinical or causal explanation.</p>
        </div>
        <ul>{analysis.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
      </section>
    </div>
  );
}
