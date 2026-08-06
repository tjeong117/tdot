import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="site-footer">
      <nav aria-label="Site">
        <Link href="/">Home</Link>
        {' · '}
        <Link href="/blog">Writing</Link>
        {' · '}
        <Link href="/research">Research</Link>
        {' · '}
        <a
          href="https://github.com/tjeong117"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        {' · '}
        <a
          href="https://www.linkedin.com/in/tomwsjeong"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
      </nav>
      <p>© {new Date().getFullYear()} Tom Jeong</p>
    </footer>
  )
}
