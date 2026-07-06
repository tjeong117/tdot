import { WatchSim } from 'app/components/watch-sim'

export const metadata = {
  title: 'Watch',
  description:
    'A kinematic simulation of a perpetual calendar watch movement — working gears, escapement, program wheel, and leap cam.',
}

export default function Page() {
  return (
    <section>
      <h1 className="font-semibold text-2xl mb-8 tracking-tighter">
        Perpetual Calendar
      </h1>
      <p className="mb-4">
        {`Outside of software I'm interested in watchmaking — especially the perpetual calendar, the complication that tracks month lengths and leap years purely mechanically, needing no correction until 2100.`}
      </p>
      <p className="mb-8">
        {`This is my design for one, modeled as a working kinematic simulation: a 4 Hz balance and Swiss-lever escapement drive the going train, a 24-hour wheel kicks a 31-tooth date star at midnight, and a 48-step program wheel read by a grand lever tells the star how many teeth to skip at month end — with a four-year leap cam that carries February 29th. Every gear below turns at its true ratio. Crank the speed up and watch years of calendar mechanics play out.`}
      </p>
      <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 md:px-8">
        <div className="mx-auto max-w-[1150px]">
          <WatchSim />
        </div>
      </div>
    </section>
  )
}
