import { Link } from 'react-router-dom';
import { ArrowLeft, Gauge } from 'lucide-react';

const linkClass = 'text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300';

export default function AboutWNS() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <Link to="/calculators/wns" className="inline-flex items-center gap-1.5 text-sm font-medium mb-3 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
          <ArrowLeft size={16} /> Back to Calculator
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Gauge size={22} className="text-brand-600" /> About WNS Calculator
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Read about the calculator, how it works, and how to use it correctly for your training programs.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">What is the Weekly Net Stimulus?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The Weekly Net Stimulus (WNS), developed by Chris Beardsley, allows us to compare the hypertrophy
          caused by training programs that use different volumes or frequency.
          <br />It equals the Weekly Hypertrophy Stimulus (stimulus per workout × workout frequency) minus the Weekly Atrophy Effect (atrophy days × daily atrophy rate).
          <br />Unlike simple volume calculations, WNS accounts for both the stimulus from training and the
          atrophy that occurs between sessions and also considers the diminishing returns of volume per session.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">How It Works</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The Weekly Net Stimulus model relies on the following data:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-disc pl-5 space-y-2">
          <li><strong className="text-gray-700 dark:text-gray-300">Volume-Stimulus Relationship:</strong> The relationship of the hypertrophy stimulus produced by the workout volume. It is used to determine the value of the workout stimulus relative to the hypertrophy produced by a single set (in arbitrary units).</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Stimulus Duration:</strong> How long the growth stimulus from a training session lasts before atrophy begins. It is used to determine the number of atrophy days (days spent losing muscle) across the week.</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Maintenance Volume:</strong> The baseline weekly volume (performed once a week) needed to prevent muscle loss. It is used (along with stimulus duration) to determine the atrophy rate (rate of muscle loss per day).</li>
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">How to Use This Calculator</h2>
        <ol className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-decimal pl-5 space-y-2">
          <li><strong className="text-gray-700 dark:text-gray-300">Select Your Dataset:</strong> Choose between Schoenfeld or Pelland meta-analyses for the volume-stimulus relationship. The "Average" option picks the average between both models. The Schoenfeld meta-analysis reports that 6 sets produce 2x the stimulus of 1 set, while the Pelland meta-analysis reports that 6 sets produce 4x the stimulus of 1 set. Nonetheless, both show diminishing returns.</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Set Maintenance Volume:</strong> Enter your estimated maintenance volume. For most people, it will be 3-4 sets once per week. However, users are free to choose between 1 and 5 sets.</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Set Stimulus Duration:</strong> Enter duration of the growth stimulus. According to research, the growth stimulus likely lasts 36-48 hours. Nonetheless, it is still left for the user to freely pick what they believe.</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Enter Volume:</strong> Input your training frequency and sets per workout. Note that these values are per individual muscle.</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Compare Programs:</strong> Use the "Compare Programs" button to see the results of different training programs (frequency/volume) side by side. On mobile, swipe to switch between programs.</li>
        </ol>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Tips for Inputs</h2>
        <ol className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-decimal pl-5 space-y-2">
          <li><strong className="text-gray-700 dark:text-gray-300">Varying Session Volume:</strong> If different sessions differ by volume, it is a good idea to input decimal values (mainly, the average across the sessions). For example, for a program on 2x frequency which consists of 3 sets on one day and 4 sets on another day, entering 3.5 sets per workout will give the desired result.</li>
          <li>
            <strong className="text-gray-700 dark:text-gray-300">Frequency Unit:</strong> If workouts are evenly spaced (Full Body every other day / Upper Lower Rest), use "every x days / every x hours" frequency unit. However, you can also input decimal frequency values (3.5x per week, 2.33x per week, etc.)
            <br />Note that values like "2x a week" are different from "every 3.5 days", since the former assumes regular workout schedules while the latter assumes evenly spaced workouts.
          </li>
          <li>
            <strong className="text-gray-700 dark:text-gray-300">Reps in Reserve:</strong> Enter how many reps you do per set and your reps in reserve (how many more reps you could have done before failure). Sets stopped short of failure count slightly less than a full set, and the further from failure, the less they count, so just enter your actual sets and the calculator accounts for it. Leave both blank if you train to failure.
          </li>
        </ol>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Understanding the Results</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The calculator outputs the net hypertrophy effect of your training program (Weekly Net Stimulus) in arbitrary units.
          Higher values indicate greater net growth, and color indicators ranging from green to red are used to indicate how good or bad the result is.
          <br />Its important to note:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-disc pl-5 space-y-2">
          <li>Arbitrary units are not a unit of measurement, rather relative units used for comparison. 1st set in a workout = 1 arbitrary unit.</li>
          <li>Individual recovery capacity varies.</li>
          <li>Life stress and nutrition may affect atrophy rates and hypertrophy stimulus.</li>
          <li>This is just a model. Real world results may vary.</li>
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Research References</h2>
        <ul className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed list-disc pl-5 space-y-2">
          <li>
            <a href="https://doi.org/10.1080/02640414.2016.1210197" target="_blank" rel="noreferrer" className={linkClass}>Schoenfeld et al. (2017)</a>{' '}
            Dose-response relationship between weekly resistance training volume and increases in muscle mass
          </li>
          <li>
            <a href="https://doi.org/10.51224/SRXIV.460" target="_blank" rel="noreferrer" className={linkClass}>Pelland et al. (2024)</a>{' '}
            Meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gain
          </li>
          <li>
            <a href="https://journals.lww.com/acsm-msse/fulltext/2011/07000/exercise_dosing_to_retain_resistance_training.7.aspx" target="_blank" rel="noreferrer" className={linkClass}>Bickel et al. (2011)</a>{' '}
            Exercise dosing to retain resistance training adaptations in young and older adults
          </li>
          <li>
            <a href="https://doi.org/10.3390/sports12070198" target="_blank" rel="noreferrer" className={linkClass}>Mpampoulis et al. (2024)</a>{' '}
            Effect of different reduced training frequencies after 12 weeks of concurrent resistance and aerobic training on muscle strength and morphology
          </li>
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Credits</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          This calculator was created by{' '}
          <a href="https://instagram.com/youssef.elezzi" target="_blank" rel="noreferrer" className={linkClass}>Youssef El Ezzi</a>{' '}
          based on Chris Beardsley's{' '}
          <a href="https://www.patreon.com/posts/weekly-net-102750269" target="_blank" rel="noreferrer" className={linkClass}>Weekly Net Stimulus model</a>.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          For more detailed information about hypertrophy training and muscle physiology, consider supporting Chris Beardsley on{' '}
          <a href="https://www.patreon.com/SandCResearch" target="_blank" rel="noreferrer" className={linkClass}>Patreon</a>.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Disclaimer</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          This calculator is based on the available data which is limited and always subject to change.
          Always try out different programs yourself to choose whats best, and more importantly, most enjoyable for you.
        </p>
      </div>
    </div>
  );
}
