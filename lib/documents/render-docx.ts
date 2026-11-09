import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { type Block, type DocumentSpec } from "./spec";

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;

function blockToChildren(block: Block, listIndex: number): Array<Paragraph | Table> {
  switch (block.type) {
    case "heading":
      return [
        new Paragraph({
          text: block.text,
          heading: HEADINGS.at(block.level - 1) ?? HeadingLevel.HEADING_3,
        }),
      ];
    case "paragraph":
      return block.text
        .split(/\n{2,}/)
        .map((part) => new Paragraph({ children: [new TextRun(part)], spacing: { after: 160 } }));
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun(item)],
            numbering: block.ordered
              ? { reference: "numbered", level: 0, instance: listIndex }
              : { reference: "bulleted", level: 0 },
          }),
      );
    case "table": {
      const columns = Math.max(...block.rows.map((row) => row.length));
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row, rowIndex) =>
              new TableRow({
                tableHeader: rowIndex === 0,
                children: Array.from(
                  { length: columns },
                  (_, column) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: row.at(column) ?? "", bold: rowIndex === 0 }),
                          ],
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
        new Paragraph({ text: "" }),
      ];
    }
  }
}

export async function renderDocx(spec: DocumentSpec): Promise<Uint8Array> {
  let lists = 0;
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: spec.title, heading: HeadingLevel.TITLE }),
  ];
  if (spec.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: spec.subtitle, italics: true, color: "555555" })],
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 8 } },
      }),
    );
  }
  for (const block of spec.blocks) {
    if (block.type === "bullets" && block.ordered) lists += 1;
    children.push(...blockToChildren(block, lists));
  }
  const document = new Document({
    title: spec.title,
    creator: "Buildr",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "bulleted",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT },
          ],
        },
        {
          reference: "numbered",
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
