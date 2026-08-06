import { Back } from 'app/components/back'

export default function NotFound() {
  return (
    <section>
      <Back />
      <h2>
        <strong>404 — Page Not Found</strong>
      </h2>
      <p>The page you are looking for does not exist.</p>
    </section>
  )
}
