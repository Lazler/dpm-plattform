-- DPM-Release 4.4 -> Schema [dpm_r4_4]
-- Erzeugt von scripts/export_access.py am 2026-10-28T14:01:40Z
-- Quelle: DPM2 Database_v 4_4_20261006.accdb (SHA-256 EF3B55F7A28E4213EA1F2E72A17C67A30F8FADBE5EE14B15170763D3767A3381)
--
-- Abschnitt TABLES legt Schema, Tabellen und Primärschlüssel an.
-- Abschnitt FOREIGN_KEYS wird von scripts/load_azure.py erst nach dem Laden aller Daten
-- ausgeführt. Das Skript verändert keine bestehenden Objekte.

-- @@SECTION TABLES
CREATE SCHEMA [dpm_r4_4];
GO
CREATE TABLE [dpm_r4_4].[Aux_CellMapping] (
    [NewCellID] int NOT NULL,
    [NewTableVID] int NOT NULL,
    [OldCellID] int NOT NULL,
    [OldTableVID] int NOT NULL,
    CONSTRAINT [PK_Aux_CellMapping] PRIMARY KEY CLUSTERED ([NewCellID], [NewTableVID])
);
GO
CREATE TABLE [dpm_r4_4].[Aux_CellStatus] (
    [TableVID] int NOT NULL,
    [CellID] int NOT NULL,
    [Status] nvarchar(max) NULL,
    [IsNewCell] bit NOT NULL,
    CONSTRAINT [PK_Aux_CellStatus] PRIMARY KEY CLUSTERED ([TableVID], [CellID])
);
GO
CREATE TABLE [dpm_r4_4].[Category] (
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [IsEnumerated] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [IsExternalRefData] bit NOT NULL,
    [RefDataSource] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [CreatedRelease] int NULL,
    [OwnerID] int NOT NULL,
    [CategoryID] int NOT NULL,
    CONSTRAINT [PK_Category] PRIMARY KEY CLUSTERED ([CategoryID])
);
GO
CREATE TABLE [dpm_r4_4].[Cell] (
    [TableID] int NOT NULL,
    [ColumnID] int NULL,
    [RowID] int NULL,
    [SheetID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [CellID] int NOT NULL,
    CONSTRAINT [PK_Cell] PRIMARY KEY CLUSTERED ([CellID])
);
GO
CREATE TABLE [dpm_r4_4].[ChangeLog] (
    [RowGUID] uniqueidentifier NOT NULL,
    [ClassID] int NOT NULL,
    [Timestamp] decimal(19,0) NOT NULL,
    [ChangeType] nvarchar(max) NOT NULL,
    [Status] nvarchar(1) NOT NULL,
    [UserEmail] nvarchar(max) NULL,
    [ReleaseID] int NOT NULL,
    [EntityID] int NULL,
    [EntityCode] nvarchar(max) NULL,
    [ActionID] int NOT NULL,
    CONSTRAINT [PK_ChangeLog] PRIMARY KEY CLUSTERED ([ActionID])
);
GO
CREATE TABLE [dpm_r4_4].[ChangeLogAttribute] (
    [ActionID] int NOT NULL,
    [AttributeID] int NOT NULL,
    [OldValue] nvarchar(max) NULL,
    [NewValue] nvarchar(max) NULL,
    [ChangeLogAttributeID] int NOT NULL,
    CONSTRAINT [PK_ChangeLogAttribute] PRIMARY KEY CLUSTERED ([ChangeLogAttributeID])
);
GO
CREATE TABLE [dpm_r4_4].[CompoundItemContext] (
    [ItemID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [ContextID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_CompoundItemContext] PRIMARY KEY CLUSTERED ([ItemID], [StartReleaseID])
);
GO
CREATE TABLE [dpm_r4_4].[CompoundKey] (
    [Signature] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [KeyID] int NOT NULL,
    CONSTRAINT [PK_CompoundKey] PRIMARY KEY CLUSTERED ([KeyID])
);
GO
CREATE TABLE [dpm_r4_4].[Concept] (
    [ConceptGUID] uniqueidentifier NOT NULL,
    [ClassID] int NOT NULL,
    [OwnerID] int NULL,
    CONSTRAINT [PK_Concept] PRIMARY KEY CLUSTERED ([ConceptGUID])
);
GO
CREATE TABLE [dpm_r4_4].[ConceptRelation] (
    [Type] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [ConceptRelationID] int NOT NULL,
    CONSTRAINT [PK_ConceptRelation] PRIMARY KEY CLUSTERED ([ConceptRelationID])
);
GO
CREATE TABLE [dpm_r4_4].[Context] (
    [Signature] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [ContextID] int NOT NULL,
    CONSTRAINT [PK_Context] PRIMARY KEY CLUSTERED ([ContextID])
);
GO
CREATE TABLE [dpm_r4_4].[ContextComposition] (
    [ContextID] int NOT NULL,
    [PropertyID] int NOT NULL,
    [ItemID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_ContextComposition] PRIMARY KEY CLUSTERED ([ContextID], [PropertyID])
);
GO
CREATE TABLE [dpm_r4_4].[DataType] (
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [ParentDataTypeID] int NULL,
    [IsActive] bit NOT NULL,
    [DataTypeID] int NOT NULL,
    CONSTRAINT [PK_DataType] PRIMARY KEY CLUSTERED ([DataTypeID])
);
GO
CREATE TABLE [dpm_r4_4].[Document] (
    [Name] nvarchar(max) NOT NULL,
    [Code] nvarchar(max) NULL,
    [Type] nvarchar(max) NOT NULL,
    [OrgID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [DocumentID] int NOT NULL,
    CONSTRAINT [PK_Document] PRIMARY KEY CLUSTERED ([DocumentID])
);
GO
CREATE TABLE [dpm_r4_4].[DocumentVersion] (
    [DocumentID] int NOT NULL,
    [Code] nvarchar(max) NOT NULL,
    [Version] nvarchar(max) NULL,
    [PublicationDate] nvarchar(10) NULL,
    [RowGUID] uniqueidentifier NULL,
    [DocumentVID] int NOT NULL,
    CONSTRAINT [PK_DocumentVersion] PRIMARY KEY CLUSTERED ([DocumentVID])
);
GO
CREATE TABLE [dpm_r4_4].[DPMAttribute] (
    [ClassID] int NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [HasTranslations] bit NOT NULL,
    [AttributeID] int NOT NULL,
    CONSTRAINT [PK_DPMAttribute] PRIMARY KEY CLUSTERED ([AttributeID])
);
GO
CREATE TABLE [dpm_r4_4].[DPMClass] (
    [Name] nvarchar(max) NOT NULL,
    [Type] nvarchar(max) NULL,
    [OwnerClassID] int NULL,
    [HasReferences] bit NOT NULL,
    [ClassID] int NOT NULL,
    CONSTRAINT [PK_DPMClass] PRIMARY KEY CLUSTERED ([ClassID])
);
GO
CREATE TABLE [dpm_r4_4].[Framework] (
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [FrameworkID] int NOT NULL,
    CONSTRAINT [PK_Framework] PRIMARY KEY CLUSTERED ([FrameworkID])
);
GO
CREATE TABLE [dpm_r4_4].[Header] (
    [TableID] int NOT NULL,
    [Direction] nvarchar(max) NOT NULL,
    [IsKey] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [IsAttribute] bit NOT NULL,
    [OwnerID] int NOT NULL,
    [HeaderID] int NOT NULL,
    CONSTRAINT [PK_Header] PRIMARY KEY CLUSTERED ([HeaderID])
);
GO
CREATE TABLE [dpm_r4_4].[HeaderVersion] (
    [HeaderID] int NOT NULL,
    [Code] nvarchar(max) NULL,
    [Label] nvarchar(max) NULL,
    [PropertyID] int NULL,
    [ContextID] int NULL,
    [SubCategoryVID] int NULL,
    [KeyVariableVID] int NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [HeaderVID] int NOT NULL,
    CONSTRAINT [PK_HeaderVersion] PRIMARY KEY CLUSTERED ([HeaderVID])
);
GO
CREATE TABLE [dpm_r4_4].[Item] (
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [IsProperty] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [ItemID] int NOT NULL,
    CONSTRAINT [PK_Item] PRIMARY KEY CLUSTERED ([ItemID])
);
GO
CREATE TABLE [dpm_r4_4].[ItemCategory] (
    [ItemID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [CategoryID] int NOT NULL,
    [Code] nvarchar(max) NOT NULL,
    [IsDefaultItem] bit NOT NULL,
    [Signature] nvarchar(max) NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_ItemCategory] PRIMARY KEY CLUSTERED ([ItemID], [StartReleaseID])
);
GO
CREATE TABLE [dpm_r4_4].[KeyComposition] (
    [KeyID] int NOT NULL,
    [VariableVID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_KeyComposition] PRIMARY KEY CLUSTERED ([KeyID], [VariableVID])
);
GO
CREATE TABLE [dpm_r4_4].[KeyHeaderMapping] (
    [AssociationID] int NOT NULL,
    [ForeignKeyHeaderID] int NOT NULL,
    [PrimaryKeyHeaderID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_KeyHeaderMapping] PRIMARY KEY CLUSTERED ([AssociationID], [ForeignKeyHeaderID])
);
GO
CREATE TABLE [dpm_r4_4].[Language] (
    [Name] nvarchar(max) NOT NULL,
    [LanguageCode] int NOT NULL,
    CONSTRAINT [PK_Language] PRIMARY KEY CLUSTERED ([LanguageCode])
);
GO
CREATE TABLE [dpm_r4_4].[ModelViolations] (
    [ViolationCode] nvarchar(max) NULL,
    [Violation] nvarchar(max) NULL,
    [isBlocking] bit NULL,
    [TableVID] int NULL,
    [OldTableVID] int NULL,
    [TableCode] nvarchar(max) NULL,
    [HeaderID] int NULL,
    [HeaderCode] nvarchar(max) NULL,
    [HeaderVID] int NULL,
    [OldHeaderVID] int NULL,
    [KeyHeader] bit NULL,
    [HeaderDirection] nvarchar(max) NULL,
    [HeaderPropertyID] int NULL,
    [HeaderPropertyCode] nvarchar(max) NULL,
    [HeaderSubcategoryID] int NULL,
    [HeaderSubcategoryName] nvarchar(max) NULL,
    [HeaderContextID] int NULL,
    [CategoryID] int NULL,
    [CategoryCode] nvarchar(max) NULL,
    [ItemID] int NULL,
    [ItemCode] nvarchar(max) NULL,
    [CellID] int NULL,
    [CellCode] nvarchar(max) NULL,
    [Cell2ID] int NULL,
    [Cell2Code] nvarchar(max) NULL,
    [VVEndReleaseID] int NULL,
    [NewAspect] nvarchar(max) NULL
);
GO
CREATE TABLE [dpm_r4_4].[Module] (
    [FrameworkID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [isDocumentModule] bit NOT NULL,
    [OwnerID] int NOT NULL,
    [ModuleID] int NOT NULL,
    CONSTRAINT [PK_Module] PRIMARY KEY CLUSTERED ([ModuleID])
);
GO
CREATE TABLE [dpm_r4_4].[ModuleParameters] (
    [ModuleVID] int NOT NULL,
    [VariableVID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_ModuleParameters] PRIMARY KEY CLUSTERED ([ModuleVID], [VariableVID])
);
GO
CREATE TABLE [dpm_r4_4].[ModuleVersion] (
    [ModuleID] int NOT NULL,
    [GlobalKeyID] int NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [VersionNumber] nvarchar(max) NULL,
    [FromReferenceDate] nvarchar(10) NOT NULL,
    [ToReferenceDate] nvarchar(10) NULL,
    [RowGUID] uniqueidentifier NULL,
    [IsReported] bit NOT NULL,
    [IsCalculated] bit NOT NULL,
    [ModuleVID] int NOT NULL,
    CONSTRAINT [PK_ModuleVersion] PRIMARY KEY CLUSTERED ([ModuleVID])
);
GO
CREATE TABLE [dpm_r4_4].[ModuleVersionComposition] (
    [ModuleVID] int NOT NULL,
    [TableID] int NOT NULL,
    [TableVID] int NOT NULL,
    [Order] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_ModuleVersionComposition] PRIMARY KEY CLUSTERED ([ModuleVID], [TableID])
);
GO
CREATE TABLE [dpm_r4_4].[OperandReference] (
    [NodeID] int NOT NULL,
    [x] int NULL,
    [y] int NULL,
    [z] int NULL,
    [OperandReference] nvarchar(max) NOT NULL,
    [ItemID] int NULL,
    [PropertyID] int NULL,
    [VariableID] int NULL,
    [SubCategoryID] int NULL,
    [OperandReferenceID] int NOT NULL,
    [OperationVID] int NULL,
    CONSTRAINT [PK_OperandReference] PRIMARY KEY CLUSTERED ([OperandReferenceID])
);
GO
CREATE TABLE [dpm_r4_4].[OperandReferenceLocation] (
    [OperandReferenceID] int NOT NULL,
    [CellID] int NOT NULL,
    [Table] nvarchar(max) NOT NULL,
    [Row] nvarchar(max) NULL,
    [Column] nvarchar(max) NULL,
    [Sheet] nvarchar(max) NULL,
    CONSTRAINT [PK_OperandReferenceLocation] PRIMARY KEY CLUSTERED ([OperandReferenceID])
);
GO
CREATE TABLE [dpm_r4_4].[Operation] (
    [Code] nvarchar(max) NOT NULL,
    [Type] nvarchar(max) NOT NULL,
    [Source] nvarchar(max) NOT NULL,
    [GroupOperID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [OperationID] int NOT NULL,
    CONSTRAINT [PK_Operation] PRIMARY KEY CLUSTERED ([OperationID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationCodePrefix] (
    [Code] nvarchar(max) NOT NULL,
    [ListName] nvarchar(max) NOT NULL,
    [FrameworkID] int NULL,
    [OperationCodePrefixID] int NOT NULL,
    CONSTRAINT [PK_OperationCodePrefix] PRIMARY KEY CLUSTERED ([OperationCodePrefixID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationNode] (
    [OperationVID] int NOT NULL,
    [ParentNodeID] int NULL,
    [OperatorID] int NULL,
    [ArgumentID] int NULL,
    [AbsoluteTolerance] decimal(19,0) NULL,
    [RelativeTolerance] decimal(19,0) NULL,
    [FallbackValue] nvarchar(max) NULL,
    [UseIntervalArithmetics] bit NOT NULL,
    [OperandType] nvarchar(max) NULL,
    [IsLeaf] bit NOT NULL,
    [Scalar] nvarchar(max) NULL,
    [NodeID] int NOT NULL,
    CONSTRAINT [PK_OperationNode] PRIMARY KEY CLUSTERED ([NodeID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationOutput] (
    [OperationVID] int NOT NULL,
    [ModuleVID] int NOT NULL,
    [OwnerID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_OperationOutput] PRIMARY KEY CLUSTERED ([OperationVID], [ModuleVID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationScope] (
    [OperationVID] int NOT NULL,
    [IsActive] bit NOT NULL,
    [Severity] nvarchar(max) NOT NULL,
    [FromSubmissionDate] nvarchar(10) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OperationScopeID] int NOT NULL,
    [CreatedReleaseID] int NOT NULL,
    CONSTRAINT [PK_OperationScope] PRIMARY KEY CLUSTERED ([OperationScopeID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationScopeComposition] (
    [OperationScopeID] int NOT NULL,
    [ModuleVID] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_OperationScopeComposition] PRIMARY KEY CLUSTERED ([OperationScopeID], [ModuleVID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationVersion] (
    [OperationVID] int NOT NULL,
    [OperationID] int NOT NULL,
    [PreconditionOperationVID] int NULL,
    [SeverityOperationVID] int NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [Expression] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [Endorsement] nvarchar(max) NULL,
    [IsVariantApproved] bit NULL,
    [OutputVariableID] int NULL,
    CONSTRAINT [PK_OperationVersion] PRIMARY KEY CLUSTERED ([OperationVID])
);
GO
CREATE TABLE [dpm_r4_4].[OperationVersionData] (
    [OperationVID] int NOT NULL,
    [Error] nvarchar(max) NULL,
    [ErrorCode] nvarchar(max) NULL,
    [IsApplying] bit NOT NULL,
    [ProposingStatus] nvarchar(max) NULL,
    CONSTRAINT [PK_OperationVersionData] PRIMARY KEY CLUSTERED ([OperationVID])
);
GO
CREATE TABLE [dpm_r4_4].[Operator] (
    [Name] nvarchar(max) NOT NULL,
    [Symbol] nvarchar(max) NOT NULL,
    [Type] nvarchar(max) NOT NULL,
    [OperatorID] int NOT NULL,
    CONSTRAINT [PK_Operator] PRIMARY KEY CLUSTERED ([OperatorID])
);
GO
CREATE TABLE [dpm_r4_4].[OperatorArgument] (
    [OperatorID] int NOT NULL,
    [Order] tinyint NOT NULL,
    [IsMandatory] bit NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [ArgumentID] int NOT NULL,
    CONSTRAINT [PK_OperatorArgument] PRIMARY KEY CLUSTERED ([ArgumentID])
);
GO
CREATE TABLE [dpm_r4_4].[Organisation] (
    [Name] nvarchar(max) NOT NULL,
    [Acronym] nvarchar(max) NULL,
    [IDPrefix] int NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OrgID] int NOT NULL,
    [URL] nvarchar(max) NULL,
    CONSTRAINT [PK_Organisation] PRIMARY KEY CLUSTERED ([OrgID])
);
GO
CREATE TABLE [dpm_r4_4].[Property] (
    [PropertyID] int NOT NULL,
    [IsComposite] bit NOT NULL,
    [IsMetric] bit NOT NULL,
    [DataTypeID] int NULL,
    [ValueLength] int NULL,
    [PeriodType] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    CONSTRAINT [PK_Property] PRIMARY KEY CLUSTERED ([PropertyID])
);
GO
CREATE TABLE [dpm_r4_4].[PropertyCategory] (
    [PropertyID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [CategoryID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_PropertyCategory] PRIMARY KEY CLUSTERED ([PropertyID], [StartReleaseID])
);
GO
CREATE TABLE [dpm_r4_4].[Reference] (
    [SubdivisionID] int NOT NULL,
    [ConceptGUID] uniqueidentifier NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_Reference] PRIMARY KEY CLUSTERED ([SubdivisionID], [ConceptGUID])
);
GO
CREATE TABLE [dpm_r4_4].[RelatedConcept] (
    [ConceptGUID] uniqueidentifier NOT NULL,
    [ConceptRelationID] int NOT NULL,
    [IsRelatedConcept] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_RelatedConcept] PRIMARY KEY CLUSTERED ([ConceptGUID], [ConceptRelationID])
);
GO
CREATE TABLE [dpm_r4_4].[Release] (
    [Code] nvarchar(max) NOT NULL,
    [Date] nvarchar(10) NOT NULL,
    [Description] nvarchar(max) NULL,
    [Status] nvarchar(max) NOT NULL,
    [IsCurrent] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [ErrorDate] datetime2 NULL,
    [Type] nvarchar(max) NOT NULL,
    [Error] nvarchar(max) NULL,
    [OwnerID] int NOT NULL,
    [ReleaseID] int NOT NULL,
    CONSTRAINT [PK_Release] PRIMARY KEY CLUSTERED ([ReleaseID])
);
GO
CREATE TABLE [dpm_r4_4].[Role] (
    [Name] nvarchar(max) NOT NULL,
    [RoleID] int NOT NULL,
    CONSTRAINT [PK_Role] PRIMARY KEY CLUSTERED ([RoleID])
);
GO
CREATE TABLE [dpm_r4_4].[SubCategory] (
    [CategoryID] int NOT NULL,
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NULL,
    [Description] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [SubCategoryID] int NOT NULL,
    CONSTRAINT [PK_SubCategory] PRIMARY KEY CLUSTERED ([SubCategoryID])
);
GO
CREATE TABLE [dpm_r4_4].[SubCategoryItem] (
    [ItemID] int NOT NULL,
    [SubCategoryVID] int NOT NULL,
    [Order] int NULL,
    [Label] nvarchar(max) NULL,
    [ParentItemID] int NULL,
    [ComparisonOperatorID] int NULL,
    [ArithmeticOperatorID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_SubCategoryItem] PRIMARY KEY CLUSTERED ([ItemID], [SubCategoryVID])
);
GO
CREATE TABLE [dpm_r4_4].[SubCategoryVersion] (
    [SubCategoryID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [SubCategoryVID] int NOT NULL,
    CONSTRAINT [PK_SubCategoryVersion] PRIMARY KEY CLUSTERED ([SubCategoryVID])
);
GO
CREATE TABLE [dpm_r4_4].[Subdivision] (
    [DocumentVID] int NOT NULL,
    [SubdivisionTypeID] int NOT NULL,
    [Number] nvarchar(max) NULL,
    [ParentSubdivisionID] int NULL,
    [StructurePath] nvarchar(max) NULL,
    [TextExcerpt] nvarchar(max) NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [SubdivisionID] int NOT NULL,
    CONSTRAINT [PK_Subdivision] PRIMARY KEY CLUSTERED ([SubdivisionID])
);
GO
CREATE TABLE [dpm_r4_4].[SubdivisionType] (
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NOT NULL,
    [SubdivisionTypeID] int NOT NULL,
    CONSTRAINT [PK_SubdivisionType] PRIMARY KEY CLUSTERED ([SubdivisionTypeID])
);
GO
CREATE TABLE [dpm_r4_4].[SuperCategoryComposition] (
    [SuperCategoryID] int NOT NULL,
    [CategoryID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_SuperCategoryComposition] PRIMARY KEY CLUSTERED ([SuperCategoryID], [CategoryID], [StartReleaseID])
);
GO
CREATE TABLE [dpm_r4_4].[Table] (
    [IsAbstract] bit NOT NULL,
    [HasOpenColumns] bit NOT NULL,
    [HasOpenRows] bit NOT NULL,
    [HasOpenSheets] bit NOT NULL,
    [IsNormalised] bit NOT NULL,
    [IsFlat] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [TableID] int NOT NULL,
    CONSTRAINT [PK_Table] PRIMARY KEY CLUSTERED ([TableID])
);
GO
CREATE TABLE [dpm_r4_4].[TableAssociation] (
    [ChildTableVID] int NOT NULL,
    [ParentTableVID] int NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [IsIdentifying] bit NOT NULL,
    [IsSubtype] bit NOT NULL,
    [SubtypeDiscriminator] int NULL,
    [ParentCardinalityAndOptionality] nvarchar(max) NOT NULL,
    [ChildCardinalityAndOptionality] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [AssociationID] int NOT NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    CONSTRAINT [PK_TableAssociation] PRIMARY KEY CLUSTERED ([AssociationID])
);
GO
CREATE TABLE [dpm_r4_4].[TableGroup] (
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [Type] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [ParentTableGroupID] int NULL,
    [OwnerID] int NOT NULL,
    [TableGroupID] int NOT NULL,
    CONSTRAINT [PK_TableGroup] PRIMARY KEY CLUSTERED ([TableGroupID])
);
GO
CREATE TABLE [dpm_r4_4].[TableGroupComposition] (
    [TableGroupID] int NOT NULL,
    [TableID] int NOT NULL,
    [Order] int NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_TableGroupComposition] PRIMARY KEY CLUSTERED ([TableGroupID], [TableID])
);
GO
CREATE TABLE [dpm_r4_4].[TableVersion] (
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [TableID] int NOT NULL,
    [AbstractTableID] int NULL,
    [KeyID] int NULL,
    [PropertyID] int NULL,
    [ContextID] int NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [TableVID] int NOT NULL,
    CONSTRAINT [PK_TableVersion] PRIMARY KEY CLUSTERED ([TableVID])
);
GO
CREATE TABLE [dpm_r4_4].[TableVersionCell] (
    [TableVID] int NOT NULL,
    [CellID] int NOT NULL,
    [CellCode] nvarchar(max) NULL,
    [IsNullable] bit NOT NULL,
    [IsExcluded] bit NOT NULL,
    [IsVoid] bit NOT NULL,
    [Sign] nvarchar(max) NULL,
    [VariableVID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_TableVersionCell] PRIMARY KEY CLUSTERED ([TableVID], [CellID])
);
GO
CREATE TABLE [dpm_r4_4].[TableVersionHeader] (
    [TableVID] int NOT NULL,
    [HeaderID] int NOT NULL,
    [HeaderVID] int NOT NULL,
    [ParentHeaderID] int NULL,
    [ParentFirst] bit NOT NULL,
    [Order] int NULL,
    [IsAbstract] bit NOT NULL,
    [IsUnique] bit NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_TableVersionHeader] PRIMARY KEY CLUSTERED ([TableVID], [HeaderID])
);
GO
CREATE TABLE [dpm_r4_4].[Translation] (
    [ConceptGUID] uniqueidentifier NOT NULL,
    [AttributeID] int NOT NULL,
    [TranslatorID] int NOT NULL,
    [LanguageCode] int NOT NULL,
    [Translation] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    CONSTRAINT [PK_Translation] PRIMARY KEY CLUSTERED ([ConceptGUID], [AttributeID], [TranslatorID], [LanguageCode])
);
GO
CREATE TABLE [dpm_r4_4].[User] (
    [OrgID] int NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [UserID] int NOT NULL,
    CONSTRAINT [PK_User] PRIMARY KEY CLUSTERED ([UserID])
);
GO
CREATE TABLE [dpm_r4_4].[UserRole] (
    [UserID] int NOT NULL,
    [RoleID] int NOT NULL,
    CONSTRAINT [PK_UserRole] PRIMARY KEY CLUSTERED ([UserID], [RoleID])
);
GO
CREATE TABLE [dpm_r4_4].[VarGeneration_Detail] (
    [noofcells] int NULL,
    [NewAspect] nvarchar(max) NULL,
    [ModuleVID] int NULL,
    [ModuleCode] nvarchar(max) NULL,
    [TableCode] nvarchar(max) NULL,
    [TableVID] int NULL,
    [CellID] int NULL,
    [cellcode] nvarchar(max) NULL,
    [outcomeID] nvarchar(max) NULL,
    [outcomeVID] nvarchar(max) NULL,
    [ReportMsg] nvarchar(max) NULL,
    [isVoid] bit NULL,
    [tvstartReleaseID] int NULL,
    [mvStartReleaseID] int NULL,
    [vvOldEndReleaseID] int NULL,
    [OldAspect] nvarchar(max) NULL,
    [IsNewCell] bit NULL,
    [isnewPropertyDataType] bit NULL,
    [isNewKey] bit NULL,
    [OldVariableID] int NULL,
    [NewVarID] int NULL,
    [OldVariableVID] int NULL,
    [NewVVID] int NULL
);
GO
CREATE TABLE [dpm_r4_4].[VarGeneration_Summary] (
    [outcomeid] nvarchar(max) NULL,
    [outcomevid] nvarchar(max) NULL,
    [ReportMsg] nvarchar(max) NULL,
    [noofcells] int NULL,
    [mincell] nvarchar(max) NULL,
    [maxcell] nvarchar(max) NULL
);
GO
CREATE TABLE [dpm_r4_4].[Variable] (
    [Type] nvarchar(max) NOT NULL,
    [RowGUID] uniqueidentifier NULL,
    [OwnerID] int NOT NULL,
    [VariableID] int NOT NULL,
    CONSTRAINT [PK_Variable] PRIMARY KEY CLUSTERED ([VariableID])
);
GO
CREATE TABLE [dpm_r4_4].[VariableGeneration] (
    [StartDate] datetime2 NOT NULL,
    [EndDate] datetime2 NULL,
    [Status] nvarchar(max) NULL,
    [ReleaseID] int NOT NULL,
    [Error] nvarchar(max) NULL,
    [VariableGenerationID] int NOT NULL,
    CONSTRAINT [PK_VariableGeneration] PRIMARY KEY CLUSTERED ([VariableGenerationID])
);
GO
CREATE TABLE [dpm_r4_4].[VariableVersion] (
    [VariableID] int NOT NULL,
    [PropertyID] int NOT NULL,
    [SubCategoryVID] int NULL,
    [ContextID] int NULL,
    [KeyID] int NULL,
    [IsMultiValued] bit NOT NULL,
    [Code] nvarchar(max) NULL,
    [Name] nvarchar(max) NULL,
    [StartReleaseID] int NOT NULL,
    [EndReleaseID] int NULL,
    [RowGUID] uniqueidentifier NULL,
    [VariableVID] int NOT NULL,
    CONSTRAINT [PK_VariableVersion] PRIMARY KEY CLUSTERED ([VariableVID])
);
GO

-- @@SECTION FOREIGN_KEYS
ALTER TABLE [dpm_r4_4].[Category] WITH CHECK ADD CONSTRAINT [FK_Category_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Category] WITH CHECK ADD CONSTRAINT [FKCategory743377] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Category] WITH CHECK ADD CONSTRAINT [FKCategory_Release] FOREIGN KEY ([CreatedRelease]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FK_Cell_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FKCell154740] FOREIGN KEY ([TableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FKCell197808] FOREIGN KEY ([RowID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FKCell269161] FOREIGN KEY ([SheetID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FKCell269422] FOREIGN KEY ([ColumnID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[Cell] WITH CHECK ADD CONSTRAINT [FKCell802206] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[ChangeLog] WITH CHECK ADD CONSTRAINT [FK_ChangeLog_DPMClass] FOREIGN KEY ([ClassID]) REFERENCES [dpm_r4_4].[DPMClass] ([ClassID]);
GO
ALTER TABLE [dpm_r4_4].[ChangeLog] WITH CHECK ADD CONSTRAINT [FK_ChangeLog_Release] FOREIGN KEY ([ReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[ChangeLogAttribute] WITH CHECK ADD CONSTRAINT [FK_ChangeLogAttribute_Action] FOREIGN KEY ([ActionID]) REFERENCES [dpm_r4_4].[ChangeLog] ([ActionID]);
GO
ALTER TABLE [dpm_r4_4].[ChangeLogAttribute] WITH CHECK ADD CONSTRAINT [FK_ChangeLogAttribute_Attribute] FOREIGN KEY ([AttributeID]) REFERENCES [dpm_r4_4].[DPMAttribute] ([AttributeID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundItemContext] WITH CHECK ADD CONSTRAINT [FKCompoundIt265848] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundItemContext] WITH CHECK ADD CONSTRAINT [FKCompoundIt363990] FOREIGN KEY ([ItemID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundItemContext] WITH CHECK ADD CONSTRAINT [FKCompoundIt742108] FOREIGN KEY ([ContextID]) REFERENCES [dpm_r4_4].[Context] ([ContextID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundItemContext] WITH CHECK ADD CONSTRAINT [FKCompoundIt823291] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundKey] WITH CHECK ADD CONSTRAINT [FK_CompoundKey_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[CompoundKey] WITH CHECK ADD CONSTRAINT [FKCompoundKe582932] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Concept] WITH CHECK ADD CONSTRAINT [FKConcept762157] FOREIGN KEY ([ClassID]) REFERENCES [dpm_r4_4].[DPMClass] ([ClassID]);
GO
ALTER TABLE [dpm_r4_4].[Concept] WITH CHECK ADD CONSTRAINT [FKConcept928356] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Context] WITH CHECK ADD CONSTRAINT [FK_Context_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Context] WITH CHECK ADD CONSTRAINT [FKContext288100] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[ContextComposition] WITH CHECK ADD CONSTRAINT [FKContextCom783218] FOREIGN KEY ([ItemID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[ContextComposition] WITH CHECK ADD CONSTRAINT [FKContextCom82273] FOREIGN KEY ([ContextID]) REFERENCES [dpm_r4_4].[Context] ([ContextID]);
GO
ALTER TABLE [dpm_r4_4].[ContextComposition] WITH CHECK ADD CONSTRAINT [FKContextCom93794] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[Document] WITH CHECK ADD CONSTRAINT [FKDocument532809] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Document] WITH CHECK ADD CONSTRAINT [FKDocument854565] FOREIGN KEY ([OrgID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[DocumentVersion] WITH CHECK ADD CONSTRAINT [FKDocumentVe733361] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[DocumentVersion] WITH CHECK ADD CONSTRAINT [FKDocumentVe77896] FOREIGN KEY ([DocumentID]) REFERENCES [dpm_r4_4].[Document] ([DocumentID]);
GO
ALTER TABLE [dpm_r4_4].[DPMAttribute] WITH CHECK ADD CONSTRAINT [FKDPMAttribu969215] FOREIGN KEY ([ClassID]) REFERENCES [dpm_r4_4].[DPMClass] ([ClassID]);
GO
ALTER TABLE [dpm_r4_4].[Framework] WITH CHECK ADD CONSTRAINT [FK_Framework_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Framework] WITH CHECK ADD CONSTRAINT [FKFramework245233] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Header] WITH CHECK ADD CONSTRAINT [FK_Header_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Header] WITH CHECK ADD CONSTRAINT [FKHeader347644] FOREIGN KEY ([TableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[Header] WITH CHECK ADD CONSTRAINT [FKHeader666999] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers165467] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers371312] FOREIGN KEY ([HeaderID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers395590] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers399933] FOREIGN KEY ([ContextID]) REFERENCES [dpm_r4_4].[Context] ([ContextID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers608023] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers699034] FOREIGN KEY ([KeyVariableVID]) REFERENCES [dpm_r4_4].[VariableVersion] ([VariableVID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers717070] FOREIGN KEY ([SubCategoryVID]) REFERENCES [dpm_r4_4].[SubCategoryVersion] ([SubCategoryVID]);
GO
ALTER TABLE [dpm_r4_4].[HeaderVersion] WITH CHECK ADD CONSTRAINT [FKHeaderVers859687] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Item] WITH CHECK ADD CONSTRAINT [FK_Item_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Item] WITH CHECK ADD CONSTRAINT [FKItem609261] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[ItemCategory] WITH CHECK ADD CONSTRAINT [FKItemCatego390588] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[ItemCategory] WITH CHECK ADD CONSTRAINT [FKItemCatego525178] FOREIGN KEY ([CategoryID]) REFERENCES [dpm_r4_4].[Category] ([CategoryID]);
GO
ALTER TABLE [dpm_r4_4].[ItemCategory] WITH CHECK ADD CONSTRAINT [FKItemCatego833144] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[ItemCategory] WITH CHECK ADD CONSTRAINT [FKItemCatego931286] FOREIGN KEY ([ItemID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[KeyComposition] WITH CHECK ADD CONSTRAINT [FKKeyComposi60275] FOREIGN KEY ([KeyID]) REFERENCES [dpm_r4_4].[CompoundKey] ([KeyID]);
GO
ALTER TABLE [dpm_r4_4].[KeyComposition] WITH CHECK ADD CONSTRAINT [FKKeyComposi605606] FOREIGN KEY ([VariableVID]) REFERENCES [dpm_r4_4].[VariableVersion] ([VariableVID]);
GO
ALTER TABLE [dpm_r4_4].[KeyHeaderMapping] WITH CHECK ADD CONSTRAINT [FKKeyHeaderM108065] FOREIGN KEY ([PrimaryKeyHeaderID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[KeyHeaderMapping] WITH CHECK ADD CONSTRAINT [FKKeyHeaderM189933] FOREIGN KEY ([AssociationID]) REFERENCES [dpm_r4_4].[TableAssociation] ([AssociationID]);
GO
ALTER TABLE [dpm_r4_4].[KeyHeaderMapping] WITH CHECK ADD CONSTRAINT [FKKeyHeaderM636398] FOREIGN KEY ([ForeignKeyHeaderID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[Module] WITH CHECK ADD CONSTRAINT [FK_Module_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Module] WITH CHECK ADD CONSTRAINT [FKModule154031] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Module] WITH CHECK ADD CONSTRAINT [FKModule328191] FOREIGN KEY ([FrameworkID]) REFERENCES [dpm_r4_4].[Framework] ([FrameworkID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleParameters] WITH CHECK ADD CONSTRAINT [FKModulePara120772] FOREIGN KEY ([VariableVID]) REFERENCES [dpm_r4_4].[VariableVersion] ([VariableVID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleParameters] WITH CHECK ADD CONSTRAINT [FKModulePara783919] FOREIGN KEY ([ModuleVID]) REFERENCES [dpm_r4_4].[ModuleVersion] ([ModuleVID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersion] WITH CHECK ADD CONSTRAINT [FKModuleVers207386] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersion] WITH CHECK ADD CONSTRAINT [FKModuleVers404440] FOREIGN KEY ([GlobalKeyID]) REFERENCES [dpm_r4_4].[CompoundKey] ([KeyID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersion] WITH CHECK ADD CONSTRAINT [FKModuleVers49266] FOREIGN KEY ([ModuleID]) REFERENCES [dpm_r4_4].[Module] ([ModuleID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersion] WITH CHECK ADD CONSTRAINT [FKModuleVers649942] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersion] WITH CHECK ADD CONSTRAINT [FKModuleVers675097] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersionComposition] WITH CHECK ADD CONSTRAINT [FKModuleVers2767] FOREIGN KEY ([TableVID]) REFERENCES [dpm_r4_4].[TableVersion] ([TableVID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersionComposition] WITH CHECK ADD CONSTRAINT [FKModuleVers724892] FOREIGN KEY ([ModuleVID]) REFERENCES [dpm_r4_4].[ModuleVersion] ([ModuleVID]);
GO
ALTER TABLE [dpm_r4_4].[ModuleVersionComposition] WITH CHECK ADD CONSTRAINT [FKModuleVers801841] FOREIGN KEY ([TableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FK_OperandReference_OperationVersion] FOREIGN KEY ([OperationVID]) REFERENCES [dpm_r4_4].[OperationVersion] ([OperationVID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FKOperandRef200461] FOREIGN KEY ([VariableID]) REFERENCES [dpm_r4_4].[Variable] ([VariableID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FKOperandRef220623] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FKOperandRef468801] FOREIGN KEY ([ItemID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FKOperandRef7492] FOREIGN KEY ([SubCategoryID]) REFERENCES [dpm_r4_4].[SubCategory] ([SubCategoryID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReference] WITH CHECK ADD CONSTRAINT [FKOperandRef996703] FOREIGN KEY ([NodeID]) REFERENCES [dpm_r4_4].[OperationNode] ([NodeID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReferenceLocation] WITH CHECK ADD CONSTRAINT [FKOperandRef286522] FOREIGN KEY ([OperandReferenceID]) REFERENCES [dpm_r4_4].[OperandReference] ([OperandReferenceID]);
GO
ALTER TABLE [dpm_r4_4].[OperandReferenceLocation] WITH CHECK ADD CONSTRAINT [FKOperandRef881860] FOREIGN KEY ([CellID]) REFERENCES [dpm_r4_4].[Cell] ([CellID]);
GO
ALTER TABLE [dpm_r4_4].[Operation] WITH CHECK ADD CONSTRAINT [FK_Operation_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Operation] WITH CHECK ADD CONSTRAINT [FKOperation195728] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[OperationCodePrefix] WITH CHECK ADD CONSTRAINT [FK__Operation__Frame__22401542] FOREIGN KEY ([FrameworkID]) REFERENCES [dpm_r4_4].[Framework] ([FrameworkID]);
GO
ALTER TABLE [dpm_r4_4].[OperationNode] WITH CHECK ADD CONSTRAINT [FKOperationN128256] FOREIGN KEY ([ArgumentID]) REFERENCES [dpm_r4_4].[OperatorArgument] ([ArgumentID]);
GO
ALTER TABLE [dpm_r4_4].[OperationNode] WITH CHECK ADD CONSTRAINT [FKOperationN554566] FOREIGN KEY ([OperatorID]) REFERENCES [dpm_r4_4].[Operator] ([OperatorID]);
GO
ALTER TABLE [dpm_r4_4].[OperationNode] WITH CHECK ADD CONSTRAINT [FKOperationN727504] FOREIGN KEY ([OperationVID]) REFERENCES [dpm_r4_4].[OperationVersion] ([OperationVID]);
GO
ALTER TABLE [dpm_r4_4].[OperationOutput] WITH CHECK ADD CONSTRAINT [FK_OperationOutput_ModuleVersion] FOREIGN KEY ([ModuleVID]) REFERENCES [dpm_r4_4].[ModuleVersion] ([ModuleVID]);
GO
ALTER TABLE [dpm_r4_4].[OperationOutput] WITH CHECK ADD CONSTRAINT [FK_OperationOutput_OperationVersion] FOREIGN KEY ([OperationVID]) REFERENCES [dpm_r4_4].[OperationVersion] ([OperationVID]);
GO
ALTER TABLE [dpm_r4_4].[OperationOutput] WITH CHECK ADD CONSTRAINT [FK_OperationOutput_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[OperationScope] WITH CHECK ADD CONSTRAINT [FK_OperationScope_CreatedRelease] FOREIGN KEY ([CreatedReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[OperationScope] WITH CHECK ADD CONSTRAINT [FKOperationS602068] FOREIGN KEY ([OperationVID]) REFERENCES [dpm_r4_4].[OperationVersion] ([OperationVID]);
GO
ALTER TABLE [dpm_r4_4].[OperationScopeComposition] WITH CHECK ADD CONSTRAINT [FKOperationS606932] FOREIGN KEY ([ModuleVID]) REFERENCES [dpm_r4_4].[ModuleVersion] ([ModuleVID]);
GO
ALTER TABLE [dpm_r4_4].[OperationScopeComposition] WITH CHECK ADD CONSTRAINT [FKOperationS658414] FOREIGN KEY ([OperationScopeID]) REFERENCES [dpm_r4_4].[OperationScope] ([OperationScopeID]);
GO
ALTER TABLE [dpm_r4_4].[OperationVersion] WITH CHECK ADD CONSTRAINT [FKOperationV135889] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[OperationVersion] WITH CHECK ADD CONSTRAINT [FKOperationV331822] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[OperationVersion] WITH CHECK ADD CONSTRAINT [FKOperationV552560] FOREIGN KEY ([OperationID]) REFERENCES [dpm_r4_4].[Operation] ([OperationID]);
GO
ALTER TABLE [dpm_r4_4].[OperationVersion] WITH CHECK ADD CONSTRAINT [FKOperationV693332] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[OperationVersionData] WITH CHECK ADD CONSTRAINT [FK_OperationVersion] FOREIGN KEY ([OperationVID]) REFERENCES [dpm_r4_4].[OperationVersion] ([OperationVID]);
GO
ALTER TABLE [dpm_r4_4].[OperatorArgument] WITH CHECK ADD CONSTRAINT [FKOperatorAr930098] FOREIGN KEY ([OperatorID]) REFERENCES [dpm_r4_4].[Operator] ([OperatorID]);
GO
ALTER TABLE [dpm_r4_4].[Organisation] WITH CHECK ADD CONSTRAINT [FKOrganisati59058] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Property] WITH CHECK ADD CONSTRAINT [FK_Property_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Property] WITH CHECK ADD CONSTRAINT [FKProperty396814] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Property] WITH CHECK ADD CONSTRAINT [FKProperty442698] FOREIGN KEY ([DataTypeID]) REFERENCES [dpm_r4_4].[DataType] ([DataTypeID]);
GO
ALTER TABLE [dpm_r4_4].[Property] WITH CHECK ADD CONSTRAINT [FKProperty578267] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[PropertyCategory] WITH CHECK ADD CONSTRAINT [FKPropertyCa118836] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[PropertyCategory] WITH CHECK ADD CONSTRAINT [FKPropertyCa323720] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[PropertyCategory] WITH CHECK ADD CONSTRAINT [FKPropertyCa732103] FOREIGN KEY ([CategoryID]) REFERENCES [dpm_r4_4].[Category] ([CategoryID]);
GO
ALTER TABLE [dpm_r4_4].[PropertyCategory] WITH CHECK ADD CONSTRAINT [FKPropertyCa906402] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[Reference] WITH CHECK ADD CONSTRAINT [FKReference310449] FOREIGN KEY ([ConceptGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Reference] WITH CHECK ADD CONSTRAINT [FKReference764763] FOREIGN KEY ([SubdivisionID]) REFERENCES [dpm_r4_4].[Subdivision] ([SubdivisionID]);
GO
ALTER TABLE [dpm_r4_4].[RelatedConcept] WITH CHECK ADD CONSTRAINT [FKRelatedCon174029] FOREIGN KEY ([ConceptRelationID]) REFERENCES [dpm_r4_4].[ConceptRelation] ([ConceptRelationID]);
GO
ALTER TABLE [dpm_r4_4].[RelatedConcept] WITH CHECK ADD CONSTRAINT [FKRelatedCon732301] FOREIGN KEY ([ConceptGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Release] WITH CHECK ADD CONSTRAINT [FK_Release_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Release] WITH CHECK ADD CONSTRAINT [FKRelease352135] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategory] WITH CHECK ADD CONSTRAINT [FK_SubCategory_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategory] WITH CHECK ADD CONSTRAINT [FKSubCategor106944] FOREIGN KEY ([CategoryID]) REFERENCES [dpm_r4_4].[Category] ([CategoryID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategory] WITH CHECK ADD CONSTRAINT [FKSubCategor997555] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryItem] WITH CHECK ADD CONSTRAINT [FKSubCategor420859] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryItem] WITH CHECK ADD CONSTRAINT [FKSubCategor541932] FOREIGN KEY ([ArithmeticOperatorID]) REFERENCES [dpm_r4_4].[Operator] ([OperatorID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryItem] WITH CHECK ADD CONSTRAINT [FKSubCategor651879] FOREIGN KEY ([ComparisonOperatorID]) REFERENCES [dpm_r4_4].[Operator] ([OperatorID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryItem] WITH CHECK ADD CONSTRAINT [FKSubCategor693348] FOREIGN KEY ([SubCategoryVID]) REFERENCES [dpm_r4_4].[SubCategoryVersion] ([SubCategoryVID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryItem] WITH CHECK ADD CONSTRAINT [FKSubCategor855005] FOREIGN KEY ([ItemID]) REFERENCES [dpm_r4_4].[Item] ([ItemID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryVersion] WITH CHECK ADD CONSTRAINT [FKSubCategor168279] FOREIGN KEY ([SubCategoryID]) REFERENCES [dpm_r4_4].[SubCategory] ([SubCategoryID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryVersion] WITH CHECK ADD CONSTRAINT [FKSubCategor727730] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[SubCategoryVersion] WITH CHECK ADD CONSTRAINT [FKSubCategor801303] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[Subdivision] WITH CHECK ADD CONSTRAINT [FK_Subdivision_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Subdivision] WITH CHECK ADD CONSTRAINT [FKSubdivisio226639] FOREIGN KEY ([DocumentVID]) REFERENCES [dpm_r4_4].[DocumentVersion] ([DocumentVID]);
GO
ALTER TABLE [dpm_r4_4].[Subdivision] WITH CHECK ADD CONSTRAINT [FKSubdivisio562876] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Subdivision] WITH CHECK ADD CONSTRAINT [FKSubdivisio763080] FOREIGN KEY ([SubdivisionTypeID]) REFERENCES [dpm_r4_4].[SubdivisionType] ([SubdivisionTypeID]);
GO
ALTER TABLE [dpm_r4_4].[SuperCategoryComposition] WITH CHECK ADD CONSTRAINT [FKSuperCateg746780] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[SuperCategoryComposition] WITH CHECK ADD CONSTRAINT [FKSuperCateg782253] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[SuperCategoryComposition] WITH CHECK ADD CONSTRAINT [FKSuperCateg825110] FOREIGN KEY ([SuperCategoryID]) REFERENCES [dpm_r4_4].[Category] ([CategoryID]);
GO
ALTER TABLE [dpm_r4_4].[SuperCategoryComposition] WITH CHECK ADD CONSTRAINT [FKSuperCateg831013] FOREIGN KEY ([CategoryID]) REFERENCES [dpm_r4_4].[Category] ([CategoryID]);
GO
ALTER TABLE [dpm_r4_4].[Table] WITH CHECK ADD CONSTRAINT [FK_Table_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Table] WITH CHECK ADD CONSTRAINT [FKTable335524] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FK_TableAssociation_EndRelease] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FK_TableAssociation_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FK_TableAssociation_StartRelease] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FKTableAssoc424624] FOREIGN KEY ([ChildTableVID]) REFERENCES [dpm_r4_4].[TableVersion] ([TableVID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FKTableAssoc473493] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FKTableAssoc546002] FOREIGN KEY ([ParentTableVID]) REFERENCES [dpm_r4_4].[TableVersion] ([TableVID]);
GO
ALTER TABLE [dpm_r4_4].[TableAssociation] WITH CHECK ADD CONSTRAINT [FKTableAssoc840717] FOREIGN KEY ([SubtypeDiscriminator]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroup] WITH CHECK ADD CONSTRAINT [FK_TableGroup_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroup] WITH CHECK ADD CONSTRAINT [FKTableGroup372000] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroup] WITH CHECK ADD CONSTRAINT [FKTableGroup70556] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroup] WITH CHECK ADD CONSTRAINT [FKTableGroup95711] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroupComposition] WITH CHECK ADD CONSTRAINT [FKTableGroup263656] FOREIGN KEY ([TableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroupComposition] WITH CHECK ADD CONSTRAINT [FKTableGroup752891] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroupComposition] WITH CHECK ADD CONSTRAINT [FKTableGroup776142] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableGroupComposition] WITH CHECK ADD CONSTRAINT [FKTableGroup783556] FOREIGN KEY ([TableGroupID]) REFERENCES [dpm_r4_4].[TableGroup] ([TableGroupID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi275581] FOREIGN KEY ([AbstractTableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi41391] FOREIGN KEY ([KeyID]) REFERENCES [dpm_r4_4].[CompoundKey] ([KeyID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi571493] FOREIGN KEY ([EndReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi607859] FOREIGN KEY ([ContextID]) REFERENCES [dpm_r4_4].[Context] ([ContextID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi783926] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi82258] FOREIGN KEY ([TableID]) REFERENCES [dpm_r4_4].[Table] ([TableID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi932385] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersion] WITH CHECK ADD CONSTRAINT [FKTableVersi957540] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionCell] WITH CHECK ADD CONSTRAINT [FKTableVersi257568] FOREIGN KEY ([TableVID]) REFERENCES [dpm_r4_4].[TableVersion] ([TableVID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionCell] WITH CHECK ADD CONSTRAINT [FKTableVersi872294] FOREIGN KEY ([VariableVID]) REFERENCES [dpm_r4_4].[VariableVersion] ([VariableVID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionCell] WITH CHECK ADD CONSTRAINT [FKTableVersi883192] FOREIGN KEY ([CellID]) REFERENCES [dpm_r4_4].[Cell] ([CellID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionHeader] WITH CHECK ADD CONSTRAINT [FKTableVersi102009] FOREIGN KEY ([ParentHeaderID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionHeader] WITH CHECK ADD CONSTRAINT [FKTableVersi622961] FOREIGN KEY ([HeaderVID]) REFERENCES [dpm_r4_4].[HeaderVersion] ([HeaderVID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionHeader] WITH CHECK ADD CONSTRAINT [FKTableVersi692213] FOREIGN KEY ([HeaderID]) REFERENCES [dpm_r4_4].[Header] ([HeaderID]);
GO
ALTER TABLE [dpm_r4_4].[TableVersionHeader] WITH CHECK ADD CONSTRAINT [FKTableVersi765341] FOREIGN KEY ([TableVID]) REFERENCES [dpm_r4_4].[TableVersion] ([TableVID]);
GO
ALTER TABLE [dpm_r4_4].[Translation] WITH CHECK ADD CONSTRAINT [FKTranslatio100921] FOREIGN KEY ([AttributeID]) REFERENCES [dpm_r4_4].[DPMAttribute] ([AttributeID]);
GO
ALTER TABLE [dpm_r4_4].[Translation] WITH CHECK ADD CONSTRAINT [FKTranslatio481615] FOREIGN KEY ([TranslatorID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Translation] WITH CHECK ADD CONSTRAINT [FKTranslatio68568] FOREIGN KEY ([ConceptGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[Translation] WITH CHECK ADD CONSTRAINT [FKTranslatio815983] FOREIGN KEY ([LanguageCode]) REFERENCES [dpm_r4_4].[Language] ([LanguageCode]);
GO
ALTER TABLE [dpm_r4_4].[User] WITH CHECK ADD CONSTRAINT [FKUser397109] FOREIGN KEY ([OrgID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[UserRole] WITH CHECK ADD CONSTRAINT [FKUserRole396295] FOREIGN KEY ([UserID]) REFERENCES [dpm_r4_4].[User] ([UserID]);
GO
ALTER TABLE [dpm_r4_4].[UserRole] WITH CHECK ADD CONSTRAINT [FKUserRole532117] FOREIGN KEY ([RoleID]) REFERENCES [dpm_r4_4].[Role] ([RoleID]);
GO
ALTER TABLE [dpm_r4_4].[Variable] WITH CHECK ADD CONSTRAINT [FK_Variable_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [dpm_r4_4].[Organisation] ([OrgID]);
GO
ALTER TABLE [dpm_r4_4].[Variable] WITH CHECK ADD CONSTRAINT [FKVariable129247] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[VariableGeneration] WITH CHECK ADD CONSTRAINT [VariableGeneration_FK] FOREIGN KEY ([ReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe350057] FOREIGN KEY ([VariableID]) REFERENCES [dpm_r4_4].[Variable] ([VariableID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe384231] FOREIGN KEY ([KeyID]) REFERENCES [dpm_r4_4].[CompoundKey] ([KeyID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe470965] FOREIGN KEY ([SubCategoryVID]) REFERENCES [dpm_r4_4].[SubCategoryVersion] ([SubCategoryVID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe588427] FOREIGN KEY ([StartReleaseID]) REFERENCES [dpm_r4_4].[Release] ([ReleaseID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe613582] FOREIGN KEY ([RowGUID]) REFERENCES [dpm_r4_4].[Concept] ([ConceptGUID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe641695] FOREIGN KEY ([PropertyID]) REFERENCES [dpm_r4_4].[Property] ([PropertyID]);
GO
ALTER TABLE [dpm_r4_4].[VariableVersion] WITH CHECK ADD CONSTRAINT [FKVariableVe817762] FOREIGN KEY ([ContextID]) REFERENCES [dpm_r4_4].[Context] ([ContextID]);
GO
