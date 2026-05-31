import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.main}>
        <p>moodmate</p>
        <h1>admin 管理台</h1>
      </section>
    </main>
  );
}
