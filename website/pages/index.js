import fs from 'fs'
import matter from 'gray-matter'
import Link from 'next/link'
import path from 'path'
import Layout from '../components/Layout'
import { docFilePaths, DOCS_PATH } from '../utils/mdxUtils'

export default function Index({ docs }) {
  return (
    <Layout>
      <h1>Jotai Docs</h1>
      <p>
        Click the link below to navigate to a page generated by{' '}
        <code>next-mdx-remote</code>.
      </p>
      <ul>
        {docs.map((doc) => (
          <li key={doc.filePath}>
            <Link href={`/${doc.filePath.replace(/\.mdx?$/, '')}`}>
              <a>{doc.filePath.replace(/\.mdx?$/, '')}</a>
            </Link>
          </li>
        ))}
      </ul>
    </Layout>
  )
}

export function getStaticProps() {
  const docs = docFilePaths.map((filePath) => {
    const source = fs.readFileSync(path.join(DOCS_PATH, filePath))
    const { content, data } = matter(source)

    return {
      content,
      data,
      filePath,
    }
  })

  return { props: { docs } }
}
